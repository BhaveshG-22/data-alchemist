import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, parseJSON, getColumnValue } from './utils';

const JSON_COLUMNS = {
  clients: ['AttributesJSON'],
};

export function validateJSONFields(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  for (const [sheetName, jsonColumns] of Object.entries(JSON_COLUMNS)) {
    const sheet = data[sheetName];
    if (!sheet) continue;

    for (const column of jsonColumns) {
      if (!sheet.headers.includes(column)) continue;

      for (let i = 0; i < sheet.rows.length; i++) {
        const value = getColumnValue(sheet.rows[i], column);


        if (!value || value === '') continue;

        const result = parseJSON(value);


        if (!result.isValid) {

          issues.push(
            createValidationIssue(
              'json_fields',
              `Invalid JSON in ${column} at row ${i}: ${result.error}`,
              {
                sheet: sheetName,
                row: i,
                column,
                value,
                type: 'error',
                suggestion: 'Ensure the JSON is properly formatted with quotes around keys and string values',
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
