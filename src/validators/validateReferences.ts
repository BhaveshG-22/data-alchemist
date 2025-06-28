import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

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
      if (!requestedTaskIDs || typeof requestedTaskIDs !== 'string') continue;

      const ids = requestedTaskIDs
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

      for (const taskId of ids) {
        if (!taskIds.has(taskId)) {
          issues.push(
            createValidationIssue(
              'references',
              `Task ID '${taskId}' in RequestedTaskIDs at row ${i} does not exist in tasks sheet`,
              {
                sheet: 'clients',
                row: i,
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

  return issues;
}
