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

        // Skip completely empty values (null, undefined, empty string)
        if (value === null || value === undefined || value === '') continue;

        const result = parseJSON(value);

        if (!result.isValid) {
          // Create more specific suggestions based on error type
          let suggestion = 'Ensure the JSON is properly formatted with quotes around keys and string values';
          
          if (result.error?.includes('null')) {
            suggestion = 'Replace null with a JSON object like {"note": "value"}';
          } else if (result.error?.includes('array')) {
            suggestion = 'Convert array to object format like {"items": ["value1", "value2"]}';
          } else if (result.error?.includes('empty')) {
            suggestion = 'Provide a JSON object like {"status": "active"} or remove the row';
          } else if (result.error?.includes('not a string')) {
            suggestion = 'Ensure the value is stored as a string containing valid JSON';
          } else if (result.error?.includes('syntax')) {
            suggestion = 'Fix JSON syntax: ensure proper quotes, commas, and brackets';
          }

          issues.push(
            createValidationIssue(
              'json_fields',
              `Invalid JSON in ${column} (row ${i + 1}): ${result.error}`,
              {
                sheet: sheetName,
                row: i,
                column,
                value,
                type: 'error',
                suggestion,
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
