import { IValidator, ValidationContext, ValidationResult, ValidationIssue, FixResult, ParsedData } from '../../types';
import { ValidationResultBuilder, FixResultBuilder } from '../../utils/ValidationResult';
import { ValidationContextHelper } from '../../utils/ValidationContext';
import { HEADER_PATTERNS } from '../../config/validationRules';

export class HeaderMappingValidator implements IValidator {
  name = 'HeaderMappingValidator';
  category = 'schema' as const;
  priority = 2; // Run after required columns check
  enabled = true;
  canFix = true;
  dependencies = ['RequiredColumnsValidator'];

  validate(context: ValidationContext): ValidationResult {
    const builder = ValidationResultBuilder.create(this.name);

    const sheets: Array<'clients' | 'workers' | 'tasks'> = ['clients', 'workers', 'tasks'];
    
    sheets.forEach(sheetType => {
      const data = ValidationContextHelper.getData(context, sheetType);
      if (!data) return;

      const mappingResult = this.createHeaderMapping(data.headers, context, sheetType);
      
      // Show header mapping suggestions
      Object.entries(mappingResult.mapping).forEach(([required, actual]) => {
        if (required !== actual) {
          builder.addWarning(
            `Suggested header mapping: "${actual}" → "${required}" (click AI fix to apply)`,
            sheetType,
            {
              category: 'header',
              suggestedFix: `Rename header "${actual}" to "${required}"`,
              fixable: true
            }
          );
        }
      });

      // Report extra headers that couldn't be mapped
      mappingResult.extraHeaders.forEach(header => {
        builder.addWarning(
          `Unexpected header: "${header}" (couldn't map to any required field)`,
          sheetType,
          {
            category: 'header',
            suggestedFix: `Remove column "${header}" or map it to a required field`
          }
        );
      });

      console.log(`📊 ${sheetType}: Mapped ${Object.keys(mappingResult.mapping).length} headers, ${mappingResult.extraHeaders.length} extra`);
    });

    return builder.build();
  }

  fix(issue: ValidationIssue, context: ValidationContext): FixResult {
    if (!issue.suggestedFix) {
      return FixResultBuilder.failure('No suggested fix available');
    }

    const data = ValidationContextHelper.getData(context, issue.sheet);
    if (!data) {
      return FixResultBuilder.failure('No data found for sheet');
    }

    // Simple approach: Look for "Rename X to Y" pattern anywhere in the suggestion
    let oldHeader: string | null = null;
    let newHeader: string | null = null;

    // Look for any pattern like "Rename X to Y" (most common in AI responses)
    let match = issue.suggestedFix.match(/Rename\s+(\w+)\s+to\s+(\w+)/i);
    if (match) {
      [, oldHeader, newHeader] = match;
    } else {
      // Fallback: Extract from Fix section and find the first quoted header for old name
      const fixMatch = issue.suggestedFix.match(/💡\s*\*\*Fix\*\*:\s*(\w+)/);
      if (fixMatch) {
        newHeader = fixMatch[1];
        // Look for any quoted text that might be the old header
        const quotedMatch = issue.suggestedFix.match(/"([^"]+)"/);
        if (quotedMatch) {
          oldHeader = quotedMatch[1];
        }
      }
    }

    // Clean up extracted headers (remove extra quotes, spaces, etc.)
    if (oldHeader) {
      oldHeader = oldHeader.replace(/['"]/g, '').trim();
    }
    if (newHeader) {
      newHeader = newHeader.replace(/['"]/g, '').trim();
    }

    // If we couldn't parse both headers, fail
    if (!oldHeader || !newHeader) {
      return FixResultBuilder.failure(`Could not extract both header names. Found: old="${oldHeader}", new="${newHeader}"`);
    }

    // Find the actual header in data (case-insensitive)
    const foundOldHeader = data.headers.find(h => h.toLowerCase() === oldHeader.toLowerCase());
    if (!foundOldHeader) {
      return FixResultBuilder.failure(`Header "${oldHeader}" not found. Available: [${data.headers.join(', ')}]`);
    }

    // Apply header rename using the found header
    const modifiedData = this.renameHeader(data, foundOldHeader, newHeader);
    
    return FixResultBuilder.success(
      `Renamed header "${foundOldHeader}" → "${newHeader}"`,
      modifiedData
    );
  }

  private createHeaderMapping(actualHeaders: string[], context: ValidationContext, sheetType: 'clients' | 'workers' | 'tasks') {
    const requiredHeaders = ValidationContextHelper.getRequiredHeaders(context, sheetType);
    const mapping: Record<string, string> = {};
    const unmappedRequired: string[] = [];
    const extraHeaders: string[] = [];

    // First pass: exact matches
    requiredHeaders.forEach(required => {
      const exactMatch = actualHeaders.find(actual => actual.toLowerCase() === required.toLowerCase());
      if (exactMatch) {
        mapping[required] = exactMatch;
      }
    });

    // Second pass: fuzzy matching for unmapped required headers
    requiredHeaders.forEach(required => {
      if (!mapping[required]) {
        const patterns = HEADER_PATTERNS[required] || [];
        const fuzzyMatch = actualHeaders.find(actual => 
          !Object.values(mapping).includes(actual) && // Not already mapped
          patterns.some(pattern => pattern.test(actual))
        );
        
        if (fuzzyMatch) {
          mapping[required] = fuzzyMatch;
        } else {
          unmappedRequired.push(required);
        }
      }
    });

    // Identify extra headers
    actualHeaders.forEach(actual => {
      if (!Object.values(mapping).includes(actual)) {
        extraHeaders.push(actual);
      }
    });

    return { mapping, unmappedRequired, extraHeaders };
  }

  private renameHeader(data: ParsedData, oldHeader: string, newHeader: string): ParsedData {
    const modifiedData = { ...data };
    
    // Update headers array
    modifiedData.headers = modifiedData.headers.map(header => 
      header === oldHeader ? newHeader : header
    );
    
    // Update all row data to use new header name
    modifiedData.rows = modifiedData.rows.map(row => {
      const newRow = { ...row };
      if (oldHeader in newRow) {
        newRow[newHeader] = newRow[oldHeader];
        delete newRow[oldHeader];
      }
      return newRow;
    });

    return modifiedData;
  }
}