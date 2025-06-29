import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

export function validateOverloadedWorkers(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  if (!data.workers) return issues;

  // First pass: Check worker capacity configuration
  for (let i = 0; i < data.workers.rows.length; i++) {
    const availableSlots = getColumnValue(data.workers.rows[i], 'AvailableSlots');
    const maxLoadPerPhase = getColumnValue(data.workers.rows[i], 'MaxLoadPerPhase');
    const workerName = getColumnValue(data.workers.rows[i], 'WorkerName');
    const workerId = getColumnValue(data.workers.rows[i], 'WorkerID');

    // Check if both values exist and are not empty
    if (availableSlots !== null && availableSlots !== undefined && availableSlots !== '' &&
        maxLoadPerPhase !== null && maxLoadPerPhase !== undefined && maxLoadPerPhase !== '') {
      
      const slots = parseFloat(String(availableSlots));
      const maxLoad = parseFloat(String(maxLoadPerPhase));
      
      // Check for invalid numbers
      if (isNaN(slots)) {
        issues.push(
          createValidationIssue(
            'overloaded_workers',
            `Worker '${workerName || workerId}' at row ${i + 1} has invalid AvailableSlots value: ${availableSlots}`,
            {
              sheet: 'workers',
              row: i,
              column: 'AvailableSlots',
              value: availableSlots,
              type: 'error',
              suggestion: 'AvailableSlots must be a valid number',
              fixable: true,
            }
          )
        );
        continue;
      }

      if (isNaN(maxLoad)) {
        issues.push(
          createValidationIssue(
            'overloaded_workers',
            `Worker '${workerName || workerId}' at row ${i + 1} has invalid MaxLoadPerPhase value: ${maxLoadPerPhase}`,
            {
              sheet: 'workers',
              row: i,
              column: 'MaxLoadPerPhase',
              value: maxLoadPerPhase,
              type: 'error',
              suggestion: 'MaxLoadPerPhase must be a valid number',
              fixable: true,
            }
          )
        );
        continue;
      }
      
      // Check for overload condition
      if (maxLoad > slots) {
        issues.push(
          createValidationIssue(
            'overloaded_workers',
            `Worker '${workerName || workerId}' at row ${i + 1} has MaxLoadPerPhase (${maxLoad}) greater than AvailableSlots (${slots})`,
            {
              sheet: 'workers',
              row: i,
              column: 'MaxLoadPerPhase',
              value: maxLoadPerPhase,
              type: 'warning',
              suggestion: `Reduce MaxLoadPerPhase to ${slots} or increase AvailableSlots`,
              fixable: true,
            }
          )
        );
      }

      // Check for zero or negative capacity
      if (maxLoad <= 0) {
        issues.push(
          createValidationIssue(
            'overloaded_workers',
            `Worker '${workerName || workerId}' at row ${i + 1} has invalid MaxLoadPerPhase: ${maxLoad}`,
            {
              sheet: 'workers',
              row: i,
              column: 'MaxLoadPerPhase',
              value: maxLoadPerPhase,
              type: 'error',
              suggestion: 'MaxLoadPerPhase must be positive',
              fixable: true,
            }
          )
        );
      }
    }
  }

  // Second pass: Simulate task assignments and check for overloads
  if (data.tasks && data.workers) {
    const workerPhaseLoad = new Map<string, Map<number, number>>();
    const workerCapacity = new Map<string, { maxLoad: number; availableSlots: number }>();
    
    // Build worker capacity map
    data.workers.rows.forEach((worker) => {
      const workerId = getColumnValue(worker, 'WorkerID');
      const maxLoadRaw = getColumnValue(worker, 'MaxLoadPerPhase');
      const availableSlotsRaw = getColumnValue(worker, 'AvailableSlots');
      
      if (workerId && typeof workerId === 'string') {
        const maxLoad = typeof maxLoadRaw === 'number' ? maxLoadRaw : 
                        typeof maxLoadRaw === 'string' ? parseFloat(maxLoadRaw) : 0;
        const availableSlots = typeof availableSlotsRaw === 'number' ? availableSlotsRaw :
                              typeof availableSlotsRaw === 'string' ? parseFloat(availableSlotsRaw) : 0;
        
        if (maxLoad > 0) {
          workerCapacity.set(workerId, { maxLoad, availableSlots });
        }
      }
    });

    // Simulate task assignments
    data.tasks.rows.forEach((task, taskIndex) => {
      const taskId = getColumnValue(task, 'TaskID');
      const requiredSkillsRaw = getColumnValue(task, 'RequiredSkills');
      const preferredPhasesRaw = getColumnValue(task, 'PreferredPhases');
      const durationRaw = getColumnValue(task, 'Duration');
      
      if (!taskId || typeof taskId !== 'string') return;
      
      const duration = typeof durationRaw === 'number' ? durationRaw :
                      typeof durationRaw === 'string' ? parseFloat(durationRaw) : 1;
      
      // Parse required skills
      const requiredSkills = new Set<string>();
      if (requiredSkillsRaw && typeof requiredSkillsRaw === 'string') {
        requiredSkillsRaw.split(',').forEach(skill => {
          const trimmed = skill.trim().toLowerCase();
          if (trimmed) requiredSkills.add(trimmed);
        });
      }

      // Parse preferred phases
      const preferredPhases: number[] = [];
      if (preferredPhasesRaw) {
        const phasesStr = String(preferredPhasesRaw);
        if (phasesStr.includes(',')) {
          phasesStr.split(',').forEach(phase => {
            const phaseNum = parseInt(phase.trim(), 10);
            if (!isNaN(phaseNum) && phaseNum > 0) {
              preferredPhases.push(phaseNum);
            }
          });
        } else {
          const phaseNum = parseInt(phasesStr, 10);
          if (!isNaN(phaseNum) && phaseNum > 0) {
            preferredPhases.push(phaseNum);
          }
        }
      }

      if (preferredPhases.length === 0) {
        preferredPhases.push(1); // Default to phase 1 if no phases specified
      }

      // Find eligible workers for this task
      const eligibleWorkers: string[] = [];
      
      data.workers!.rows.forEach((worker) => {
        const workerId = getColumnValue(worker, 'WorkerID');
        const workerSkillsRaw = getColumnValue(worker, 'Skills');
        
        if (!workerId || typeof workerId !== 'string') return;
        
        // Check if worker has required skills
        const workerSkills = new Set<string>();
        if (workerSkillsRaw && typeof workerSkillsRaw === 'string') {
          workerSkillsRaw.split(',').forEach(skill => {
            const trimmed = skill.trim().toLowerCase();
            if (trimmed) workerSkills.add(trimmed);
          });
        }
        
        // Check if worker has all required skills
        let hasAllSkills = true;
        for (const skill of requiredSkills) {
          if (!workerSkills.has(skill)) {
            hasAllSkills = false;
            break;
          }
        }
        
        if (hasAllSkills) {
          eligibleWorkers.push(workerId);
        }
      });

      // Simulate assignment to first available eligible worker
      if (eligibleWorkers.length > 0) {
        const assignedWorker = eligibleWorkers[0]; // Simple assignment to first eligible
        
        for (const phase of preferredPhases) {
          // Initialize worker phase tracking
          if (!workerPhaseLoad.has(assignedWorker)) {
            workerPhaseLoad.set(assignedWorker, new Map());
          }
          
          const workerPhases = workerPhaseLoad.get(assignedWorker)!;
          const currentLoad = workerPhases.get(phase) || 0;
          
          // Add this task's duration to the worker's load in this phase
          workerPhases.set(phase, currentLoad + duration);
          
          // Check if this exceeds capacity
          const capacity = workerCapacity.get(assignedWorker);
          if (capacity && (currentLoad + duration) > capacity.maxLoad) {
            const workerRow = data.workers!.rows.findIndex(w => getColumnValue(w, 'WorkerID') === assignedWorker);
            issues.push(
              createValidationIssue(
                'overloaded_workers',
                `Worker ${assignedWorker} would be overloaded in Phase ${phase} (load: ${currentLoad + duration}, capacity: ${capacity.maxLoad})`,
                {
                  sheet: 'workers',
                  row: workerRow >= 0 ? workerRow : taskIndex,
                  column: 'MaxLoadPerPhase',
                  value: capacity.maxLoad,
                  type: 'warning',
                  suggestion: `Redistribute tasks or increase ${assignedWorker}'s MaxLoadPerPhase to ${currentLoad + duration}`,
                  fixable: true,
                }
              )
            );
          }
          
          break; // Only assign to first preferred phase for this simulation
        }
      }
    });
  }

  return issues;
}