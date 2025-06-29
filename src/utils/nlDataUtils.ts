import { ParsedData } from './fileParser';

export interface DataModification {
  operation: 'update' | 'delete' | 'add';
  rowIndex?: number;
  rowId?: string;
  data?: Record<string, unknown>;
  newRow?: Record<string, unknown>;
}

export interface ModificationResult {
  success: boolean;
  modifiedData?: ParsedData;
  affectedRows?: number;
  error?: string;
}

/**
 * Apply a series of modifications to data safely with rollback capability
 */
export function applyDataModifications(
  originalData: ParsedData,
  modifications: DataModification[]
): ModificationResult {
  try {
    const newRows = [...originalData.rows];
    let affectedRows = 0;

    // Sort modifications: deletes in descending order, others in ascending
    const sortedMods = [...modifications].sort((a, b) => {
      if (a.operation === 'delete' && b.operation === 'delete') {
        return (b.rowIndex || 0) - (a.rowIndex || 0);
      }
      if (a.operation === 'delete') return 1;
      if (b.operation === 'delete') return -1;
      return (a.rowIndex || 0) - (b.rowIndex || 0);
    });

    for (const mod of sortedMods) {
      switch (mod.operation) {
        case 'update':
          if (typeof mod.rowIndex === 'number' && mod.data) {
            if (mod.rowIndex >= 0 && mod.rowIndex < newRows.length) {
              // Preserve data types when updating
              const updatedRow = { ...newRows[mod.rowIndex] };
              for (const [key, value] of Object.entries(mod.data)) {
                updatedRow[key] = preserveDataType(originalData.rows[mod.rowIndex][key], value);
              }
              newRows[mod.rowIndex] = updatedRow;
              affectedRows++;
            }
          }
          break;

        case 'delete':
          if (typeof mod.rowIndex === 'number') {
            if (mod.rowIndex >= 0 && mod.rowIndex < newRows.length) {
              newRows.splice(mod.rowIndex, 1);
              affectedRows++;
            }
          }
          break;

        case 'add':
          if (mod.newRow) {
            // Ensure new row has all required columns
            const completeRow: Record<string, unknown> = {};
            for (const header of originalData.headers) {
              completeRow[header] = mod.newRow[header] ?? '';
            }
            newRows.push(completeRow);
            affectedRows++;
          }
          break;
      }
    }

    return {
      success: true,
      modifiedData: {
        headers: originalData.headers,
        rows: newRows,
      },
      affectedRows,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during modification',
    };
  }
}

/**
 * Preserve the original data type when updating values
 */
function preserveDataType(originalValue: unknown, newValue: unknown): unknown {
  if (originalValue === null || originalValue === undefined) {
    return newValue;
  }

  const originalType = typeof originalValue;
  const newType = typeof newValue;

  // If types match, return as-is
  if (originalType === newType) {
    return newValue;
  }

  // Type conversion based on original type
  switch (originalType) {
    case 'number':
      const num = Number(newValue);
      return isNaN(num) ? newValue : num;

    case 'boolean':
      if (typeof newValue === 'string') {
        return newValue.toLowerCase() === 'true';
      }
      return Boolean(newValue);

    case 'string':
      return String(newValue);

    case 'object':
      if (Array.isArray(originalValue)) {
        if (typeof newValue === 'string') {
          try {
            const parsed = JSON.parse(newValue);
            return Array.isArray(parsed) ? parsed : [newValue];
          } catch {
            return newValue.split(',').map(s => s.trim());
          }
        }
        return Array.isArray(newValue) ? newValue : [newValue];
      }
      return newValue;

    default:
      return newValue;
  }
}

/**
 * Validate data modifications before applying them
 */
export function validateModifications(
  data: ParsedData,
  modifications: DataModification[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const mod of modifications) {
    switch (mod.operation) {
      case 'update':
        if (typeof mod.rowIndex !== 'number') {
          errors.push('Update operation requires rowIndex');
        } else if (mod.rowIndex < 0 || mod.rowIndex >= data.rows.length) {
          errors.push(`Invalid rowIndex ${mod.rowIndex} (must be 0-${data.rows.length - 1})`);
        }
        if (!mod.data || Object.keys(mod.data).length === 0) {
          errors.push('Update operation requires data');
        }
        break;

      case 'delete':
        if (typeof mod.rowIndex !== 'number') {
          errors.push('Delete operation requires rowIndex');
        } else if (mod.rowIndex < 0 || mod.rowIndex >= data.rows.length) {
          errors.push(`Invalid rowIndex ${mod.rowIndex} for delete`);
        }
        break;

      case 'add':
        if (!mod.newRow) {
          errors.push('Add operation requires newRow');
        }
        break;

      default:
        errors.push(`Unknown operation: ${(mod as any).operation}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a human-readable preview of modifications
 */
export function generateModificationPreview(
  data: ParsedData,
  modifications: DataModification[]
): string {
  const previews: string[] = [];

  for (const mod of modifications) {
    switch (mod.operation) {
      case 'update':
        if (typeof mod.rowIndex === 'number' && mod.data) {
          const row = data.rows[mod.rowIndex];
          const changes = Object.entries(mod.data)
            .map(([key, newValue]) => `${key}: ${row[key]} → ${newValue}`)
            .join(', ');
          previews.push(`Row ${mod.rowIndex + 1}: ${changes}`);
        }
        break;

      case 'delete':
        if (typeof mod.rowIndex === 'number') {
          previews.push(`Delete row ${mod.rowIndex + 1}`);
        }
        break;

      case 'add':
        if (mod.newRow) {
          const newRowStr = Object.entries(mod.newRow)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          previews.push(`Add new row: ${newRowStr}`);
        }
        break;
    }
  }

  return previews.join('\n');
}

/**
 * Create an undo operation for a set of modifications
 */
export function createUndoModifications(
  originalData: ParsedData,
  modifications: DataModification[]
): DataModification[] {
  const undoMods: DataModification[] = [];

  // Reverse the order of operations
  for (let i = modifications.length - 1; i >= 0; i--) {
    const mod = modifications[i];

    switch (mod.operation) {
      case 'update':
        if (typeof mod.rowIndex === 'number' && mod.data) {
          const originalRow = originalData.rows[mod.rowIndex];
          const revertData: Record<string, unknown> = {};
          for (const key of Object.keys(mod.data)) {
            revertData[key] = originalRow[key];
          }
          undoMods.push({
            operation: 'update',
            rowIndex: mod.rowIndex,
            data: revertData,
          });
        }
        break;

      case 'delete':
        if (typeof mod.rowIndex === 'number') {
          const deletedRow = originalData.rows[mod.rowIndex];
          undoMods.push({
            operation: 'add',
            newRow: deletedRow,
          });
        }
        break;

      case 'add':
        // For undo of add, we need to delete the last row
        // This is approximate since we don't know the exact position
        undoMods.push({
          operation: 'delete',
          rowIndex: originalData.rows.length, // Will be adjusted
        });
        break;
    }
  }

  return undoMods;
}