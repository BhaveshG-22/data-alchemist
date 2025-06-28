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

    if (availableSlots && maxLoadPerPhase) {
      const slots = parseFloat(availableSlots);
      const maxLoad = parseFloat(maxLoadPerPhase);
      
      if (!isNaN(slots) && !isNaN(maxLoad) && maxLoad > slots) {
        issues.push(
          createValidationIssue(
            'overloaded_workers',
            `Worker '${workerName}' at row ${i + 1} has MaxLoadPerPhase (${maxLoad}) greater than AvailableSlots (${slots})`,
            {
              sheet: 'workers',
              row: i + 1,
              column: 'MaxLoadPerPhase',
              value: maxLoad,
              type: 'error',
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