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

      // Check feasibility against available workers
      if (data.workers && requiredSkills) {
        const skillsArray = String(requiredSkills).split(',').map(s => s.trim());
        const availableWorkers = data.workers.rows.filter(worker => {
          const workerSkills = getColumnValue(worker, 'Skills');
          if (!workerSkills) return false;
          
          const workerSkillsArray = String(workerSkills).split(',').map(s => s.trim());
          return skillsArray.every(skill => workerSkillsArray.includes(skill));
        });

        if (availableWorkers.length === 0) {
          issues.push(
            createValidationIssue(
              'concurrency_feasibility',
              `Task '${taskName || taskId}' at row ${i + 1} requires skills [${skillsArray.join(', ')}] but no workers have these skills`,
              {
                sheet: 'tasks',
                row: i,
                column: 'RequiredSkills',
                value: requiredSkills,
                type: 'warning',
                suggestion: 'Ensure workers with required skills are available or adjust skill requirements',
                fixable: false,
              }
            )
          );
        } else if (maxConcurrentNum > availableWorkers.length) {
          issues.push(
            createValidationIssue(
              'concurrency_feasibility',
              `Task '${taskName || taskId}' at row ${i + 1} wants MaxConcurrent=${maxConcurrentNum} but only ${availableWorkers.length} workers have required skills`,
              {
                sheet: 'tasks',
                row: i,
                column: 'MaxConcurrent',
                value: maxConcurrent,
                type: 'warning',
                suggestion: `Reduce MaxConcurrent to ${availableWorkers.length} or add more skilled workers`,
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