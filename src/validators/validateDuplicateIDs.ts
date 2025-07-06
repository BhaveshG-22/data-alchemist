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

    // Collect all existing IDs first to generate better suggestions
    const allIds = new Set<string>();
    for (let i = 0; i < sheet.rows.length; i++) {
      const value = String(getColumnValue(sheet.rows[i], idColumn) || '').trim();
      if (value) allIds.add(value);
    }

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
              row: i,
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
        const suggestion = findNextAvailableId(value, allIds);
        const context = getRowContext(sheet, i, idColumn);
        
        issues.push(
          createValidationIssue(
            'duplicate_ids',
            `Duplicate ${idColumn} '${value}' found in row ${i + 1}${context.contextInfo}`,
            {
              sheet: sheetName,
              row: i,
              column: idColumn,
              value,
              type: 'error',
              suggestion: `Change '${value}' to '${suggestion}' (next available ID)${context.contextSuggestion}`,
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

function getRowContext(sheet: any, currentRowIndex: number, idColumn: string): { contextInfo: string; contextSuggestion: string } {
  const contextIds: string[] = [];
  const contextRows: number[] = [];
  
  // Get IDs from 2 rows above and 2 rows below
  for (let offset = -2; offset <= 2; offset++) {
    if (offset === 0) continue; // Skip current row
    
    const rowIndex = currentRowIndex + offset;
    if (rowIndex >= 0 && rowIndex < sheet.rows.length) {
      const contextId = String(getColumnValue(sheet.rows[rowIndex], idColumn) || '').trim();
      if (contextId) {
        contextIds.push(contextId);
        contextRows.push(rowIndex + 1); // Convert to 1-based row numbers
      }
    }
  }
  
  let contextInfo = '';
  let contextSuggestion = '';
  
  if (contextIds.length > 0) {
    const contextList = contextIds.map((id, index) => `${id} (row ${contextRows[index]})`).join(', ');
    contextInfo = `. Context: ${contextList}`;
    
    // Analyze the sequence to suggest a better ID
    const sequentialSuggestion = findSequentialId(contextIds);
    if (sequentialSuggestion) {
      contextSuggestion = `. Based on nearby IDs, consider '${sequentialSuggestion}'`;
    }
  }
  
  return { contextInfo, contextSuggestion };
}

function findSequentialId(nearbyIds: string[]): string | null {
  // Extract numbers from nearby IDs to find a pattern
  const numbers: number[] = [];
  let commonPrefix = '';
  
  for (const id of nearbyIds) {
    const match = id.match(/^([A-Za-z]*)(\d+)$/);
    if (match) {
      if (!commonPrefix) commonPrefix = match[1];
      if (match[1] === commonPrefix) {
        numbers.push(parseInt(match[2], 10));
      }
    }
  }
  
  if (numbers.length >= 2 && commonPrefix) {
    // Sort numbers to find gaps or patterns
    numbers.sort((a, b) => a - b);
    
    // Look for a gap in the sequence
    for (let i = 0; i < numbers.length - 1; i++) {
      const gap = numbers[i + 1] - numbers[i];
      if (gap > 1) {
        // Found a gap, suggest the missing number
        const suggestion = numbers[i] + 1;
        const numLength = nearbyIds[0].match(/(\d+)$/)?.[1]?.length || 3;
        return `${commonPrefix}${String(suggestion).padStart(numLength, '0')}`;
      }
    }
    
    // No gaps found, suggest next in sequence
    const maxNum = Math.max(...numbers);
    const numLength = nearbyIds[0].match(/(\d+)$/)?.[1]?.length || 3;
    return `${commonPrefix}${String(maxNum + 1).padStart(numLength, '0')}`;
  }
  
  return null;
}

function findNextAvailableId(originalId: string, existingIds: Set<string>): string {
  // Extract prefix and number from ID (e.g., "T002" -> "T", 2)
  const match = originalId.match(/^([A-Za-z]*)(\d+)$/);
  if (!match) return originalId + '_1';
  
  const prefix = match[1];
  const startNum = parseInt(match[2], 10);
  const numLength = match[2].length;
  
  // Find next available number
  let counter = startNum + 1;
  let suggestion: string;
  
  do {
    suggestion = `${prefix}${String(counter).padStart(numLength, '0')}`;
    counter++;
  } while (existingIds.has(suggestion));
  
  return suggestion;
}