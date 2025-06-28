import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

const ID_COLUMNS = {
  clients: 'ClientID',
  workers: 'WorkerID',
  tasks: 'TaskID',
};

export function validateDuplicateIDs(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  for (const [sheetName, idColumn] of Object.entries(ID_COLUMNS)) {
    const sheet = data[sheetName];
    if (!sheet || !sheet.headers.includes(idColumn)) continue;

    const seenValues = new Set<string>();
    
    for (let i = 0; i < sheet.rows.length; i++) {
      const value = String(getColumnValue(sheet.rows[i], idColumn) || '').trim();
      
      if (!value) {
        issues.push(
          createValidationIssue(
            'duplicate_ids',
            `Empty ${idColumn} in row ${i + 1}`,
            {
              sheet: sheetName,
              row: i + 1,
              column: idColumn,
              type: 'error',
              suggestion: `Provide a unique ${idColumn}`,
              fixable: true,
            }
          )
        );
        continue;
      }

      if (seenValues.has(value)) {
        issues.push(
          createValidationIssue(
            'duplicate_ids',
            `Duplicate ${idColumn} '${value}' found in row ${i + 1}`,
            {
              sheet: sheetName,
              row: i + 1,
              column: idColumn,
              value,
              type: 'error',
              suggestion: `Change '${value}' to a unique identifier`,
              fixable: true,
            }
          )
        );
      } else {
        seenValues.add(value);
      }
    }
  }

  return issues;
}