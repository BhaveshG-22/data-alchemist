import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

export function validateOverloadedWorkers(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  if (!data.workers) return issues;

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
    }
  }

  return issues;
}