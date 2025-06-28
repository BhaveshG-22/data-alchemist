import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

export function validateConcurrencyFeasibility(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  if (!data.tasks) return issues;

  for (let i = 0; i < data.tasks.rows.length; i++) {
    const maxConcurrent = getColumnValue(data.tasks.rows[i], 'MaxConcurrent');
    const taskName = getColumnValue(data.tasks.rows[i], 'TaskName');
    
    if (maxConcurrent) {
      const maxConcurrentNum = parseFloat(maxConcurrent);
      
      if (!isNaN(maxConcurrentNum) && maxConcurrentNum <= 0) {
        issues.push(
          createValidationIssue(
            'concurrency_feasibility',
            `Task '${taskName}' at row ${i + 1} has invalid MaxConcurrent value: ${maxConcurrent}`,
            {
              sheet: 'tasks',
              row: i + 1,
              column: 'MaxConcurrent',
              value: maxConcurrent,
              type: 'error',
              suggestion: 'MaxConcurrent must be a positive number',
              fixable: true,
            }
          )
        );
      }
    }
  }

  return issues;
}