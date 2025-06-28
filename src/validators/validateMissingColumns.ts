import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue } from './utils';

const REQUIRED_COLUMNS = {
  clients: ['ClientID', 'ClientName', 'PriorityLevel', 'RequestedTaskIDs', 'GroupTag', 'AttributesJSON'],
  workers: ['WorkerID', 'WorkerName', 'Skills', 'AvailableSlots', 'MaxLoadPerPhase', 'WorkerGroup', 'QualificationLevel'],
  tasks: ['TaskID', 'TaskName', 'Category', 'Duration', 'RequiredSkills', 'PreferredPhases', 'MaxConcurrent'],
};

export function validateMissingColumns(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  for (const [sheetName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    const sheet = data[sheetName];
    
    if (!sheet) {
      issues.push(
        createValidationIssue(
          'missing_columns',
          `Missing required sheet: ${sheetName}`,
          {
            sheet: sheetName,
            type: 'error',
            suggestion: `Add a sheet named '${sheetName}' to your file`,
            fixable: false,
          }
        )
      );
      continue;
    }

    const missingColumns = requiredColumns.filter(
      column => !sheet.headers.includes(column)
    );

    const unexpectedColumns = sheet.headers.filter(
      header => !requiredColumns.includes(header)
    );

    // Only create an issue if there are missing or unexpected columns
    if (missingColumns.length > 0 || unexpectedColumns.length > 0) {
      let message = '';
      if (missingColumns.length > 0 && unexpectedColumns.length > 0) {
        message = `Header issues in sheet '${sheetName}': Missing ${missingColumns.length} required columns, ${unexpectedColumns.length} unexpected columns`;
      } else if (missingColumns.length > 0) {
        message = `Missing ${missingColumns.length} required column${missingColumns.length > 1 ? 's' : ''} in sheet '${sheetName}': ${missingColumns.join(', ')}`;
      } else {
        message = `${unexpectedColumns.length} unexpected column${unexpectedColumns.length > 1 ? 's' : ''} in sheet '${sheetName}': ${unexpectedColumns.join(', ')}`;
      }

      const issue = createValidationIssue(
        'missing_columns',
        message,
        {
          sheet: sheetName,
          type: 'error',
          suggestion: `Fix header issues in ${sheetName} sheet`,
          fixable: true,
        }
      );
      
      // Add additional data for AI fix (stored on the issue object)
      (issue as any).missingColumns = missingColumns;
      (issue as any).unexpectedColumns = unexpectedColumns;
      
      issues.push(issue);
    }
  }

  return issues;
}

