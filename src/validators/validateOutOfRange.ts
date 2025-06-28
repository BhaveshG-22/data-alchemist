import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, isInRange, getColumnValue } from './utils';

const RANGE_VALIDATIONS = {
  clients: {
    PriorityLevel: { min: 1, max: 5 },
  },
  workers: {
    QualificationLevel: { min: 1, max: 10 },
  },
  tasks: {
    Duration: { min: 0.1 },
    MaxConcurrent: { min: 1 },
  },
};

export function validateOutOfRange(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  for (const [sheetName, validations] of Object.entries(RANGE_VALIDATIONS)) {
    const sheet = data[sheetName];
    if (!sheet) continue;

    for (const [column, range] of Object.entries(validations)) {
      if (!sheet.headers.includes(column)) continue;

      for (let i = 0; i < sheet.rows.length; i++) {
        const value = getColumnValue(sheet.rows[i], column);
        if (value === null || value === undefined || value === '') continue;

        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          issues.push(
            createValidationIssue(
              'out_of_range',
              `Invalid number '${value}' in ${column} at row ${i + 1}`,
              {
                sheet: sheetName,
                row: i + 1,
                column,
                value,
                type: 'error',
                suggestion: `Enter a valid number`,
                fixable: true,
              }
            )
          );
          continue;
        }

        if (!isInRange(numValue, range.min, range.max)) {
          const rangeText = getRangeText(range.min, range.max);
          issues.push(
            createValidationIssue(
              'out_of_range',
              `Value ${numValue} in ${column} at row ${i + 1} is out of range ${rangeText}`,
              {
                sheet: sheetName,
                row: i + 1,
                column,
                value,
                type: 'error',
                suggestion: `Enter a value ${rangeText}`,
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

function getRangeText(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) {
    return `between ${min} and ${max}`;
  }
  if (min !== undefined) {
    return `>= ${min}`;
  }
  if (max !== undefined) {
    return `<= ${max}`;
  }
  return '';
}