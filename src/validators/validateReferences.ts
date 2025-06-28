import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, parseNumericArray, getColumnValue } from './utils';

export function validateReferences(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  // Validate RequestedTaskIDs in clients sheet reference actual tasks
  if (data.clients && data.tasks) {
    const taskIds = new Set(
      data.tasks.rows.map(row => String(getColumnValue(row, 'TaskID')).trim())
    );

    for (let i = 0; i < data.clients.rows.length; i++) {
      const requestedTaskIDs = getColumnValue(data.clients.rows[i], 'RequestedTaskIDs');
      if (!requestedTaskIDs) continue;

      const result = parseNumericArray(requestedTaskIDs);
      if (result.isValid && result.parsed) {
        for (const taskId of result.parsed) {
          const taskIdStr = String(taskId);
          if (!taskIds.has(taskIdStr)) {
            issues.push(
              createValidationIssue(
                'references',
                `Task ID '${taskId}' in RequestedTaskIDs at row ${i + 1} does not exist in tasks sheet`,
                {
                  sheet: 'clients',
                  row: i + 1,
                  column: 'RequestedTaskIDs',
                  value: taskId,
                  type: 'error',
                  suggestion: `Ensure task '${taskId}' exists in the tasks sheet or remove it from RequestedTaskIDs`,
                  fixable: true,
                }
              )
            );
          }
        }
      }
    }
  }

  return issues;
}