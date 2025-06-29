import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

export function validateConcurrencyFeasibility(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  if (!data.tasks) return issues;

  for (let i = 0; i < data.tasks.rows.length; i++) {
    const maxConcurrent = getColumnValue(data.tasks.rows[i], 'MaxConcurrent');
    const taskName = getColumnValue(data.tasks.rows[i], 'TaskName');
    const taskId = getColumnValue(data.tasks.rows[i], 'TaskID');
    const requiredSkills = getColumnValue(data.tasks.rows[i], 'RequiredSkills');
    
    // Validate MaxConcurrent value
    if (maxConcurrent !== null && maxConcurrent !== undefined && maxConcurrent !== '') {
      const maxConcurrentNum = parseFloat(String(maxConcurrent));
      
      if (isNaN(maxConcurrentNum)) {
        issues.push(
          createValidationIssue(
            'concurrency_feasibility',
            `Task '${taskName || taskId}' at row ${i + 1} has invalid MaxConcurrent value: ${maxConcurrent}`,
            {
              sheet: 'tasks',
              row: i,
              column: 'MaxConcurrent',
              value: maxConcurrent,
              type: 'error',
              suggestion: 'MaxConcurrent must be a valid number',
              fixable: true,
            }
          )
        );
        continue;
      }
      
      if (maxConcurrentNum <= 0) {
        issues.push(
          createValidationIssue(
            'concurrency_feasibility',
            `Task '${taskName || taskId}' at row ${i + 1} has invalid MaxConcurrent value: ${maxConcurrent}`,
            {
              sheet: 'tasks',
              row: i,
              column: 'MaxConcurrent',
              value: maxConcurrent,
              type: 'error',
              suggestion: 'MaxConcurrent must be a positive number',
              fixable: true,
            }
          )
        );
        continue;
      }

      // Check feasibility against available workers with phase awareness
      if (data.workers && requiredSkills) {
        const skillsArray = String(requiredSkills).split(',').map(s => s.trim().toLowerCase());
        const preferredPhasesRaw = getColumnValue(data.tasks.rows[i], 'PreferredPhases');
        
        // Parse preferred phases for this task
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
        
        // Find workers with required skills
        const availableWorkers = data.workers.rows.filter(worker => {
          const workerSkills = getColumnValue(worker, 'Skills');
          if (!workerSkills) return false;
          
          const workerSkillsArray = String(workerSkills).split(',').map(s => s.trim().toLowerCase());
          return skillsArray.every(skill => workerSkillsArray.includes(skill));
        });

        // Check worker availability in preferred phases
        const workersAvailableInPhases = availableWorkers.filter(worker => {
          const availableSlots = getColumnValue(worker, 'AvailableSlots');
          const maxLoad = getColumnValue(worker, 'MaxLoadPerPhase');
          
          // Simple check: if worker has slots and load capacity, assume available in all phases
          // In reality, you'd have specific phase availability data
          const slots = typeof availableSlots === 'number' ? availableSlots :
                       typeof availableSlots === 'string' ? parseFloat(availableSlots) : 0;
          const load = typeof maxLoad === 'number' ? maxLoad :
                      typeof maxLoad === 'string' ? parseFloat(maxLoad) : 0;
          
          return slots > 0 && load > 0;
        });

        if (skillsArray.length > 0 && availableWorkers.length === 0) {
          issues.push(
            createValidationIssue(
              'concurrency_feasibility',
              `Task '${taskName || taskId}' at row ${i + 1} requires skills [${skillsArray.join(', ')}] but no workers have these skills`,
              {
                sheet: 'tasks',
                row: i,
                column: 'RequiredSkills',
                value: requiredSkills,
                type: 'error',
                suggestion: 'Ensure workers with required skills are available or adjust skill requirements',
                fixable: false,
              }
            )
          );
        } else if (maxConcurrentNum > workersAvailableInPhases.length) {
          const phaseInfo = preferredPhases.length > 1 ? 
            `phases ${preferredPhases.join(', ')}` : 
            `phase ${preferredPhases[0]}`;
            
          issues.push(
            createValidationIssue(
              'concurrency_feasibility',
              `Task '${taskName || taskId}' at row ${i + 1} wants MaxConcurrent=${maxConcurrentNum} but only ${workersAvailableInPhases.length} qualified workers are available in ${phaseInfo}`,
              {
                sheet: 'tasks',
                row: i,
                column: 'MaxConcurrent',
                value: maxConcurrent,
                type: 'warning',
                suggestion: workersAvailableInPhases.length > 0 ? 
                  `Reduce MaxConcurrent to ${workersAvailableInPhases.length} or add more skilled workers` :
                  `Add workers with required skills [${skillsArray.join(', ')}] or change task phases`,
                fixable: true,
              }
            )
          );
        } else if (maxConcurrentNum > availableWorkers.length) {
          // Edge case: workers exist but not available in preferred phases
          issues.push(
            createValidationIssue(
              'concurrency_feasibility',
              `Task '${taskName || taskId}' at row ${i + 1} wants MaxConcurrent=${maxConcurrentNum} but only ${availableWorkers.length} workers have required skills (${workersAvailableInPhases.length} available in preferred phases)`,
              {
                sheet: 'tasks',
                row: i,
                column: 'MaxConcurrent',
                value: maxConcurrent,
                type: 'warning',
                suggestion: `Reduce MaxConcurrent to ${workersAvailableInPhases.length} or adjust worker phase availability`,
                fixable: true,
              }
            )
          );
        }

        // Additional check: Warn if concurrency is 1 but multiple skilled workers exist
        if (maxConcurrentNum === 1 && availableWorkers.length > 3) {
          issues.push(
            createValidationIssue(
              'concurrency_feasibility',
              `Task '${taskName || taskId}' at row ${i + 1} has MaxConcurrent=1 but ${availableWorkers.length} qualified workers exist`,
              {
                sheet: 'tasks',
                row: i,
                column: 'MaxConcurrent',
                value: maxConcurrent,
                type: 'info',
                suggestion: `Consider increasing MaxConcurrent to leverage additional skilled workers and reduce duration`,
                fixable: true,
              }
            )
          );
        }
      }
    }
  }

  return issues;
}