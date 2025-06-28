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

    // Create individual issues for each missing required column
    for (const column of missingColumns) {
      issues.push(
        createValidationIssue(
          'missing_columns',
          `Missing required column '${column}' in sheet '${sheetName}'`,
          {
            sheet: sheetName,
            column,
            row: -1, // Use -1 to indicate header row
            type: 'error',
            suggestion: `Add column '${column}' to the ${sheetName} sheet`,
            fixable: false,
          }
        )
      );
    }

    // Note: We ignore unexpected columns - only flag missing required ones
  }

  return issues;
}

