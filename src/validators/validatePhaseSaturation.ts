import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

export function validatePhaseSaturation(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  if (!data.workers || !data.tasks) return issues;

  // Build phase capacity map from workers
  const phaseCapacity = new Map<number, number>();
  const workerPhaseAvailability = new Map<string, number[]>();

  // Calculate total available slots per phase
  data.workers.rows.forEach((worker) => {
    const workerId = getColumnValue(worker, 'WorkerID');
    const availableSlotsRaw = getColumnValue(worker, 'AvailableSlots');
    const maxLoadRaw = getColumnValue(worker, 'MaxLoadPerPhase');
    
    if (workerId && typeof workerId === 'string') {
      const availableSlots = typeof availableSlotsRaw === 'number' ? availableSlotsRaw :
                            typeof availableSlotsRaw === 'string' ? parseFloat(availableSlotsRaw) : 0;
      const maxLoad = typeof maxLoadRaw === 'number' ? maxLoadRaw :
                     typeof maxLoadRaw === 'string' ? parseFloat(maxLoadRaw) : 0;
      
      if (availableSlots > 0 && maxLoad > 0) {
        // Assume workers are available across all phases for simplicity
        // In reality, you'd have specific phase availability data
        const workerPhases = [1, 2, 3, 4, 5]; // Default phases
        workerPhaseAvailability.set(workerId, workerPhases);
        
        workerPhases.forEach(phase => {
          const currentCapacity = phaseCapacity.get(phase) || 0;
          phaseCapacity.set(phase, currentCapacity + maxLoad);
        });
      }
    }
  });

  // Calculate task demand per phase
  const phaseDemand = new Map<number, { totalDuration: number; taskCount: number; tasks: string[] }>();

  data.tasks.rows.forEach((task) => {
    const taskId = getColumnValue(task, 'TaskID');
    const durationRaw = getColumnValue(task, 'Duration');
    const preferredPhasesRaw = getColumnValue(task, 'PreferredPhases');
    const requiredSkillsRaw = getColumnValue(task, 'RequiredSkills');
    
    if (!taskId || typeof taskId !== 'string') return;
    
    const duration = typeof durationRaw === 'number' ? durationRaw :
                    typeof durationRaw === 'string' ? parseFloat(durationRaw) : 1;
    
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

    // Check if task has required skills that exist in worker pool
    const requiredSkills = new Set<string>();
    if (requiredSkillsRaw && typeof requiredSkillsRaw === 'string') {
      requiredSkillsRaw.split(',').forEach(skill => {
        const trimmed = skill.trim().toLowerCase();
        if (trimmed) requiredSkills.add(trimmed);
      });
    }

    // Check if any workers can do this task
    let hasEligibleWorkers = false;
    if (requiredSkills.size === 0) {
      hasEligibleWorkers = true; // No specific skills required
    } else {
      data.workers!.rows.forEach((worker) => {
        const workerSkillsRaw = getColumnValue(worker, 'Skills');
        if (workerSkillsRaw && typeof workerSkillsRaw === 'string') {
          const workerSkills = new Set<string>();
          workerSkillsRaw.split(',').forEach(skill => {
            const trimmed = skill.trim().toLowerCase();
            if (trimmed) workerSkills.add(trimmed);
          });
          
          let hasAllSkills = true;
          for (const skill of Array.from(requiredSkills)) {
            if (!workerSkills.has(skill)) {
              hasAllSkills = false;
              break;
            }
          }
          
          if (hasAllSkills) {
            hasEligibleWorkers = true;
          }
        }
      });
    }

    // Only count demand if there are workers who can do the task
    if (hasEligibleWorkers) {
      // Add demand to the first preferred phase (simplified allocation)
      const targetPhase = preferredPhases[0];
      const demandInfo = phaseDemand.get(targetPhase) || { totalDuration: 0, taskCount: 0, tasks: [] };
      demandInfo.totalDuration += duration;
      demandInfo.taskCount += 1;
      demandInfo.tasks.push(taskId);
      phaseDemand.set(targetPhase, demandInfo);
    }
  });

  // Check for phase saturation
  for (const [phase, demand] of Array.from(phaseDemand.entries())) {
    const capacity = phaseCapacity.get(phase) || 0;
    
    if (demand.totalDuration > capacity) {
      const saturationPercentage = capacity > 0 ? Math.round((demand.totalDuration / capacity) * 100) : 0;
      const overloadAmount = demand.totalDuration - capacity;
      
      // Find the best redistribution solution
      const redistributionPlan = findOptimalRedistribution(
        phase, 
        demand, 
        overloadAmount, 
        phaseDemand, 
        phaseCapacity, 
        data
      );
      
      issues.push(
        createValidationIssue(
          'phase_saturation',
          `Phase ${phase} is oversaturated: ${demand.totalDuration} duration units demanded vs ${capacity} capacity (${saturationPercentage}%)`,
          {
            sheet: 'tasks',
            row: -1, // Global issue
            column: 'PreferredPhases',
            value: phase,
            type: 'error',
            suggestion: redistributionPlan.suggestion,
            fixable: redistributionPlan.fixable,
            autoFix: redistributionPlan.autoFix,
          }
        )
      );
    } else if (demand.totalDuration > capacity * 0.8) {
      // Warning for high utilization (>80%)
      const utilizationPercentage = capacity > 0 ? Math.round((demand.totalDuration / capacity) * 100) : 0;
      
      issues.push(
        createValidationIssue(
          'phase_saturation',
          `Phase ${phase} has high utilization: ${demand.totalDuration} duration units vs ${capacity} capacity (${utilizationPercentage}%)`,
          {
            sheet: 'tasks',
            row: -1, // Global issue
            column: 'PreferredPhases',
            value: phase,
            type: 'warning',
            suggestion: `Consider redistributing some tasks from Phase ${phase} to avoid bottlenecks`,
            fixable: false,
          }
        )
      );
    }
  }

  // Check for phases with zero capacity but task demand
  for (const [phase, demand] of Array.from(phaseDemand.entries())) {
    const capacity = phaseCapacity.get(phase) || 0;
    
    if (capacity === 0 && demand.totalDuration > 0) {
      issues.push(
        createValidationIssue(
          'phase_saturation',
          `Phase ${phase} has task demand but zero worker capacity`,
          {
            sheet: 'workers',
            row: -1, // Global issue
            column: 'AvailableSlots',
            value: 0,
            type: 'error',
            suggestion: `Assign workers to Phase ${phase} or move tasks to phases with available capacity`,
            fixable: false,
          }
        )
      );
    }
  }

  // Check for unused phases with high capacity
  for (const [phase, capacity] of Array.from(phaseCapacity.entries())) {
    const demand = phaseDemand.get(phase);
    
    if (!demand && capacity > 0) {
      issues.push(
        createValidationIssue(
          'phase_saturation',
          `Phase ${phase} has worker capacity (${capacity}) but no task demand`,
          {
            sheet: 'tasks',
            row: -1, // Global issue
            column: 'PreferredPhases',
            value: phase,
            type: 'info',
            suggestion: `Consider moving tasks to Phase ${phase} to balance workload`,
            fixable: false,
          }
        )
      );
    }
  }

  return issues;
}

interface RedistributionPlan {
  suggestion: string;
  fixable: boolean;
  autoFix?: {
    action: 'redistributeTasks';
    tasks: { taskId: string; fromPhase: number; toPhase: number; duration: number; reasoning: string }[];
  };
}

function findOptimalRedistribution(
  overloadedPhase: number,
  demand: { totalDuration: number; taskCount: number; tasks: string[] },
  overloadAmount: number,
  allPhaseDemand: Map<number, { totalDuration: number; taskCount: number; tasks: string[] }>,
  allPhaseCapacity: Map<number, number>,
  data: any
): RedistributionPlan {
  // Find tasks from the overloaded phase with their durations
  const tasksInPhase: Array<{ taskId: string; duration: number; skills: string[] }> = [];
  
  data.tasks.rows.forEach((task: any, index: number) => {
    const taskId = getColumnValue(task, 'TaskID');
    const preferredPhasesRaw = getColumnValue(task, 'PreferredPhases');
    const durationRaw = getColumnValue(task, 'Duration');
    const requiredSkillsRaw = getColumnValue(task, 'RequiredSkills');
    
    if (!taskId || typeof taskId !== 'string') return;
    
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
    
    // If this task is assigned to the overloaded phase
    if (preferredPhases.includes(overloadedPhase) || 
        (preferredPhases.length === 0 && overloadedPhase === 1)) {
      
      const duration = typeof durationRaw === 'number' ? durationRaw :
                      typeof durationRaw === 'string' ? parseFloat(durationRaw) : 1;
      
      const skills: string[] = [];
      if (requiredSkillsRaw && typeof requiredSkillsRaw === 'string') {
        requiredSkillsRaw.split(',').forEach(skill => {
          const trimmed = skill.trim().toLowerCase();
          if (trimmed) skills.push(trimmed);
        });
      }
      
      tasksInPhase.push({ taskId, duration, skills });
    }
  });
  
  // Find target phases with available capacity
  const targetPhases: Array<{ phase: number; availableCapacity: number }> = [];
  for (const [phase, capacity] of Array.from(allPhaseCapacity.entries())) {
    if (phase !== overloadedPhase) {
      const currentDemand = allPhaseDemand.get(phase)?.totalDuration || 0;
      const availableCapacity = capacity - currentDemand;
      if (availableCapacity > 0) {
        targetPhases.push({ phase, availableCapacity });
      }
    }
  }
  
  // Sort target phases by available capacity (most capacity first)
  targetPhases.sort((a, b) => b.availableCapacity - a.availableCapacity);
  
  // Sort tasks by duration (smallest first, easier to fit)
  tasksInPhase.sort((a, b) => a.duration - b.duration);
  
  // Create redistribution plan
  const redistributions: Array<{ taskId: string; fromPhase: number; toPhase: number; duration: number; reasoning: string }> = [];
  let remainingOverload = overloadAmount;
  
  for (const task of tasksInPhase) {
    if (remainingOverload <= 0) break;
    
    // Find a suitable target phase for this task
    for (const target of targetPhases) {
      if (target.availableCapacity >= task.duration) {
        redistributions.push({
          taskId: task.taskId,
          fromPhase: overloadedPhase,
          toPhase: target.phase,
          duration: task.duration,
          reasoning: `Phase ${target.phase} has ${target.availableCapacity} units available capacity`
        });
        
        target.availableCapacity -= task.duration;
        remainingOverload -= task.duration;
        break;
      }
    }
  }
  
  // Generate suggestion and auto-fix
  if (redistributions.length > 0) {
    const taskList = redistributions.slice(0, 3).map(r => r.taskId).join(', ');
    const moreText = redistributions.length > 3 ? ` and ${redistributions.length - 3} more` : '';
    const targetPhaseList = Array.from(new Set(redistributions.map(r => r.toPhase))).join(', ');
    
    return {
      suggestion: `Move tasks ${taskList}${moreText} from Phase ${overloadedPhase} to Phase(s) ${targetPhaseList} (saves ${Math.round(redistributions.reduce((sum, r) => sum + r.duration, 0))} duration units)`,
      fixable: true,
      autoFix: {
        action: 'redistributeTasks',
        tasks: redistributions
      }
    };
  } else {
    // No suitable redistribution found
    const totalAvailableCapacity = targetPhases.reduce((sum, t) => sum + t.availableCapacity, 0);
    
    if (totalAvailableCapacity === 0) {
      return {
        suggestion: `No other phases have available capacity. Consider adding more workers or reducing task durations in Phase ${overloadedPhase}`,
        fixable: false
      };
    } else {
      return {
        suggestion: `Available capacity in other phases (${Math.round(totalAvailableCapacity)} units) is insufficient for large tasks. Consider splitting tasks or adding workers`,
        fixable: false
      };
    }
  }
}