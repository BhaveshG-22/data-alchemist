import { IValidator, ValidationContext, ValidationResult } from '../../types';
import { ValidationResultBuilder } from '../../utils/ValidationResult';
import { ValidationContextHelper } from '../../utils/ValidationContext';

export class RequiredColumnsValidator implements IValidator {
  name = 'RequiredColumnsValidator';
  category = 'schema' as const;
  priority = 1; // Run first
  enabled = true;
  canFix = false; // Cannot auto-fix missing columns

  validate(context: ValidationContext): ValidationResult {
    const builder = ValidationResultBuilder.create(this.name);

    // Check each sheet type
    const sheets: Array<'clients' | 'workers' | 'tasks'> = ['clients', 'workers', 'tasks'];
    
    sheets.forEach(sheetType => {
      const data = ValidationContextHelper.getData(context, sheetType);
      if (!data) return; // Skip if no data for this sheet

      const requiredHeaders = ValidationContextHelper.getRequiredHeaders(context, sheetType);
      const actualHeaders = data.headers;

      // Find missing required headers
      const missingHeaders = requiredHeaders.filter(required => 
        !actualHeaders.some(actual => actual.toLowerCase() === required.toLowerCase())
      );

      // Find unexpected headers (not in required list)
      const unexpectedHeaders = actualHeaders.filter(actual =>
        !requiredHeaders.some(required => required.toLowerCase() === actual.toLowerCase())
      );

      missingHeaders.forEach(missingHeader => {
        // If there are unexpected headers, suggest smart matching with AI
        if (unexpectedHeaders.length > 0) {
          // Create smart header matching suggestion
          const sampleDataForUnexpected = this.getSampleDataForHeaders(data, unexpectedHeaders);
          
          builder.addError(
            `Missing required column: ${missingHeader}`,
            sheetType,
            {
              category: 'smart_header_match',
              suggestedFix: this.createSmartMatchingSuggestion(missingHeader, unexpectedHeaders, sampleDataForUnexpected),
              fixable: true
            }
          );
        } else {
          // No unexpected headers, just suggest adding the column
          builder.addError(
            `Missing required column: ${missingHeader}`,
            sheetType,
            {
              category: 'header',
              suggestedFix: `Add column "${missingHeader}" to your ${sheetType} file`
            }
          );
        }
      });

      // Log successful validation
      if (missingHeaders.length === 0) {
        console.log(`✅ ${sheetType}: All required columns present`);
      } else {
        console.log(`❌ ${sheetType}: Missing ${missingHeaders.length} required columns`);
      }
    });

    return builder.build();
  }
}