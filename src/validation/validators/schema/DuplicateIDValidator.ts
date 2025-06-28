import { IValidator, ValidationContext, ValidationResult, ValidationIssue, FixResult } from '../../types';
import { ValidationResultBuilder, FixResultBuilder } from '../../utils/ValidationResult';
import { ValidationContextHelper } from '../../utils/ValidationContext';

export class DuplicateIDValidator implements IValidator {
  name = 'DuplicateIDValidator';
  category = 'schema' as const;
  priority = 3;
  enabled = true;
  canFix = true;

  validate(context: ValidationContext): ValidationResult {
    const builder = ValidationResultBuilder.create(this.name);

    // Check each sheet for duplicate IDs
    this.checkSheetDuplicates(context, 'clients', 'ClientID', builder);
    this.checkSheetDuplicates(context, 'workers', 'WorkerID', builder);
    this.checkSheetDuplicates(context, 'tasks', 'TaskID', builder);

    return builder.build();
  }

  fix(issue: ValidationIssue, context: ValidationContext): FixResult {
    const data = ValidationContextHelper.getData(context, issue.sheet);
    if (!data || !issue.column) {
      return FixResultBuilder.failure('Cannot fix: missing data or column information');
    }

    // Generate unique ID for the duplicate
    const modifiedData = { ...data };
    const idColumn = issue.column;
    
    if (issue.row !== undefined) {
      const currentId = String(modifiedData.rows[issue.row][idColumn] || '');
      const newId = this.generateUniqueId(currentId, modifiedData.rows, idColumn);
      
      modifiedData.rows = [...modifiedData.rows];
      modifiedData.rows[issue.row] = {
        ...modifiedData.rows[issue.row],
        [idColumn]: newId
      };

      return FixResultBuilder.success(
        `Generated unique ID: ${currentId} → ${newId}`,
        modifiedData
      );
    }

    return FixResultBuilder.failure('Cannot fix: row information missing');
  }

  private checkSheetDuplicates(
    context: ValidationContext, 
    sheetType: 'clients' | 'workers' | 'tasks',
    idColumn: string,
    builder: ValidationResultBuilder
  ): void {
    const data = ValidationContextHelper.getData(context, sheetType);
    if (!data) return;

    // Check if the ID column exists
    if (!data.headers.includes(idColumn)) {
      console.log(`⚠️ ${sheetType}: ID column ${idColumn} not found, skipping duplicate check`);
      return;
    }

    const idCounts = new Map<string, number[]>();
    
    // Count occurrences of each ID and track row indices
    data.rows.forEach((row, index) => {
      const id = String(row[idColumn] || '').trim();
      if (id === '') return; // Skip empty IDs
      
      if (!idCounts.has(id)) {
        idCounts.set(id, []);
      }
      idCounts.get(id)!.push(index);
    });

    // Find duplicates and add issues
    let duplicateCount = 0;
    idCounts.forEach((rowIndices, id) => {
      if (rowIndices.length > 1) {
        duplicateCount++;
        
        // Add issue for each duplicate occurrence (except the first one)
        rowIndices.slice(1).forEach(rowIndex => {
          builder.addError(
            `Duplicate ${idColumn}: "${id}" (found in ${rowIndices.length} rows)`,
            sheetType,
            {
              row: rowIndex,
              column: idColumn,
              category: 'data',
              suggestedFix: `Generate unique ID for duplicate "${id}"`,
              fixable: true
            }
          );
        });
      }
    });

    if (duplicateCount === 0) {
      console.log(`✅ ${sheetType}: No duplicate ${idColumn}s found`);
    } else {
      console.log(`❌ ${sheetType}: Found ${duplicateCount} duplicate ${idColumn}s`);
    }
  }

  private generateUniqueId(baseId: string, rows: Record<string, unknown>[], idColumn: string): string {
    const existingIds = new Set(rows.map(row => String(row[idColumn] || '')));
    
    // Try appending numbers until we find a unique ID
    let counter = 1;
    let newId = `${baseId}_${counter}`;
    
    while (existingIds.has(newId)) {
      counter++;
      newId = `${baseId}_${counter}`;
    }
    
    return newId;
  }
}