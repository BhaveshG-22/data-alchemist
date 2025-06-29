import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, parseNumericArray, getColumnValue } from './utils';

const LIST_COLUMNS = {
  clients: ['RequestedTaskIDs'],
  workers: ['Skills', 'AvailableSlots'],
  tasks: ['RequiredSkills'],
};

export function validateMalformedLists(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  for (const [sheetName, listColumns] of Object.entries(LIST_COLUMNS)) {
    const sheet = data[sheetName];
    if (!sheet) continue;

    for (const column of listColumns) {
      if (!sheet.headers.includes(column)) continue;

      for (let i = 0; i < sheet.rows.length; i++) {
        const value = getColumnValue(sheet.rows[i], column);
        if (!value) continue;

        if (isNumericListColumn(column)) {
          const result = parseNumericArray(value);
          if (!result.isValid) {
            issues.push(
              createValidationIssue(
                'malformed_lists',
                `Invalid numeric list in ${column} at row ${i + 1}: ${result.error}`,
                {
                  sheet: sheetName,
                  row: i,
                  column,
                  value,
                  type: 'error',
                  suggestion: 'Use comma-separated numbers (e.g., "1,2,3")',
                  fixable: true,
                }
              )
            );
          }
        } else {
          // String list validation
          if (typeof value === 'string') {
            const items = value.split(',').map(s => s.trim()).filter(Boolean);
            if (items.length === 0) {
              issues.push(
                createValidationIssue(
                  'malformed_lists',
                  `Empty list in ${column} at row ${i + 1}`,
                  {
                    sheet: sheetName,
                    row: i,
                    column,
                    value,
                    type: 'warning',
                    suggestion: 'Provide at least one item or leave cell empty',
                    fixable: true,
                  }
                )
              );
            }
          }
        }
      }
    }
  }

  return issues;
}

function isNumericListColumn(column: string): boolean {
  return ['AvailableSlots'].includes(column);
}