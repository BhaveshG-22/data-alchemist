import { IValidator, ValidationContext, ValidationResult, ValidationIssue, FixResult } from '../../types';
import { ValidationResultBuilder, FixResultBuilder } from '../../utils/ValidationResult';
import { ValidationContextHelper } from '../../utils/ValidationContext';
import { DATA_REQUIREMENTS } from '../../config/validationRules';

export class JSONValidator implements IValidator {
  name = 'JSONValidator';
  category = 'dataType' as const;
  priority = 10;
  enabled = true;
  canFix = true;

  validate(context: ValidationContext): ValidationResult {
    const builder = ValidationResultBuilder.create(this.name);

    // Check each sheet for JSON fields
    this.validateJSONFields(context, 'clients', builder);
    this.validateJSONFields(context, 'workers', builder);
    this.validateJSONFields(context, 'tasks', builder);

    return builder.build();
  }

  fix(issue: ValidationIssue, context: ValidationContext): FixResult {
    const data = ValidationContextHelper.getData(context, issue.sheet);
    if (!data || issue.row === undefined || !issue.column) {
      return FixResultBuilder.failure('Cannot fix: missing data or location information');
    }

    const modifiedData = { ...data };
    const currentValue = String(modifiedData.rows[issue.row][issue.column] || '');
    
    // Check if AI suggestion is available (from UI)
    if (issue.suggestedFix) {
      return this.applyAISuggestion(issue, modifiedData, currentValue);
    }
    
    // Fallback: simple fix with empty JSON object
    const fixedJSON = '{}';
    
    modifiedData.rows = [...modifiedData.rows];
    modifiedData.rows[issue.row] = {
      ...modifiedData.rows[issue.row],
      [issue.column]: fixedJSON
    };

    return FixResultBuilder.success(
      `Replaced invalid JSON with empty object: "${currentValue}" → "${fixedJSON}"`,
      modifiedData
    );
  }

  private applyAISuggestion(
    issue: ValidationIssue, 
    modifiedData: any, 
    currentValue: string
  ): FixResult {
    try {
      // Extract JSON from AI suggestion
      const suggestion = issue.suggestedFix || '';
      
      // Try multiple patterns to extract JSON from AI response
      let suggestedJSON = '';
      
      // Pattern 1: Look for JSON in "Fix:" section
      const fixMatch = suggestion.match(/💡\s*\*\*Fix\*\*:\s*(\{[\s\S]*?\})/);
      if (fixMatch) {
        suggestedJSON = fixMatch[1].trim();
      } else {
        // Pattern 2: Look for any JSON object in the response
        const jsonMatch = suggestion.match(/(\{[\s\S]*?\})/);
        if (jsonMatch) {
          suggestedJSON = jsonMatch[1].trim();
        } else {
          // Pattern 3: Look for JSON after common keywords
          const keywordMatch = suggestion.match(/(?:fix|solution|answer|result):\s*(\{[\s\S]*?\})/i);
          if (keywordMatch) {
            suggestedJSON = keywordMatch[1].trim();
          }
        }
      }
      
      if (suggestedJSON) {
        // Validate the suggested JSON
        JSON.parse(suggestedJSON);
        
        // Apply the AI-suggested fix
        modifiedData.rows = [...modifiedData.rows];
        modifiedData.rows[issue.row!] = {
          ...modifiedData.rows[issue.row!],
          [issue.column!]: suggestedJSON
        };

        return FixResultBuilder.success(
          `AI-converted to valid JSON: "${currentValue}" → "${suggestedJSON}"`,
          modifiedData
        );
      }
      
      // If no valid JSON found in suggestion, fall back to simple fix
      throw new Error('No valid JSON found in AI suggestion');
      
    } catch (error) {
      
      // Fallback to simple fix if AI suggestion fails
      const fixedJSON = '{}';
      modifiedData.rows = [...modifiedData.rows];
      modifiedData.rows[issue.row!] = {
        ...modifiedData.rows[issue.row!],
        [issue.column!]: fixedJSON
      };

      return FixResultBuilder.success(
        `AI suggestion failed, used fallback: "${currentValue}" → "${fixedJSON}"`,
        modifiedData
      );
    }
  }

  private validateJSONFields(
    context: ValidationContext,
    sheetType: 'clients' | 'workers' | 'tasks',
    builder: ValidationResultBuilder
  ): void {
    const data = ValidationContextHelper.getData(context, sheetType);
    if (!data) return;

    const requirements = DATA_REQUIREMENTS[sheetType];
    const jsonColumns = Object.entries(requirements.types)
      .filter(([, type]) => type === 'json')
      .map(([column]) => column);

    jsonColumns.forEach(column => {
      if (!data.headers.includes(column)) return;

      data.rows.forEach((row, rowIndex) => {
        const value = row[column];
        if (!value || String(value).trim() === '') return; // Skip empty values

        const stringValue = String(value);
        try {
          JSON.parse(stringValue);
        } catch {
          builder.addError(
            `Invalid JSON format in ${column}`,
            sheetType,
            {
              row: rowIndex,
              column,
              category: 'format',
              suggestedFix: `Convert "${stringValue}" to valid JSON format`,
              fixable: true
            }
          );
        }
      });
    });

    console.log(`🔍 ${sheetType}: Validated ${jsonColumns.length} JSON columns`);
  }


}