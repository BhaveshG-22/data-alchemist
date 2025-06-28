import { ValidationContext, ValidationResult, ValidationIssue, IValidator, ParsedData, FixResult } from './types';
import { ValidatorRegistry } from './utils/ValidatorRegistry';
import { ValidationResultAggregator } from './utils/ValidationResult';
import { ValidationContextHelper } from './utils/ValidationContext';

export class ValidationEngine {
  private registry: ValidatorRegistry;
  private aggregator: ValidationResultAggregator;

  constructor() {
    this.registry = ValidatorRegistry.getInstance();
    this.aggregator = new ValidationResultAggregator();
  }

  /**
   * Run all enabled validators in the correct order
   */
  async runValidation(context: ValidationContext): Promise<ValidationIssue[]> {
    console.log('🔍 Starting validation process...');
    this.aggregator = new ValidationResultAggregator(); // Reset for new validation
    
    const validators = this.registry.getExecutionOrder(context);
    console.log(`📋 Running ${validators.length} validators:`, validators.map(v => v.name));

    for (const validator of validators) {
      try {
        console.log(`⚡ Running ${validator.name}...`);
        const result = await this.runValidator(validator, context);
        this.aggregator.add(result);

        // In strict mode, stop on first error
        if (ValidationContextHelper.isStrictMode(context) && result.issues.some(issue => issue.type === 'error')) {
          console.log(`❌ Stopping validation due to errors in ${validator.name} (strict mode)`);
          break;
        }

        // Skip dependent validators if this validator failed and skipDependentValidators is true
        if (context.config.skipDependentValidators && result.issues.some(issue => issue.type === 'error')) {
          console.log(`⏭️ Skipping validators dependent on ${validator.name}`);
          // Could implement logic to skip dependent validators here
        }

      } catch (error) {
        console.error(`💥 Error in validator ${validator.name}:`, error);
        // Add a system error issue
        this.aggregator.add({
          issues: [{
            type: 'error',
            category: 'data',
            message: `Validator ${validator.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            sheet: 'clients', // Default sheet
            severity: 'high',
            validatorName: validator.name,
            fixable: false
          }],
          success: false,
          validatorName: validator.name,
          executionTime: 0
        });
      }
    }

    const summary = this.aggregator.getExecutionSummary();
    console.log(`✅ Validation complete: ${summary.issueCount} issues found in ${summary.totalTime}ms`);
    
    return this.aggregator.getAllIssues();
  }

  /**
   * Run validation for a specific category only
   */
  async runValidationByCategory(context: ValidationContext, category: IValidator['category']): Promise<ValidationIssue[]> {
    const validators = this.registry.getByCategory(category)
      .filter(validator => validator.enabled && ValidationContextHelper.isValidatorEnabled(context, validator.name));
    
    const sortedValidators = this.registry.getSortedByPriority(validators);
    this.aggregator = new ValidationResultAggregator();

    for (const validator of sortedValidators) {
      const result = await this.runValidator(validator, context);
      this.aggregator.add(result);
    }

    return this.aggregator.getAllIssues();
  }

  /**
   * Run a single validator
   */
  async runValidator(validator: IValidator, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      const result = validator.validate(context);
      const executionTime = Date.now() - startTime;
      
      return {
        ...result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        issues: [{
          type: 'error',
          category: 'data',
          message: `Validator execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sheet: 'clients',
          severity: 'high',
          validatorName: validator.name,
          fixable: false
        }],
        success: false,
        validatorName: validator.name,
        executionTime
      };
    }
  }

  /**
   * Apply fix for a specific issue
   */
  async applyFix(issue: ValidationIssue, context: ValidationContext): Promise<{ success: boolean; message: string; modifiedData?: ParsedData }> {
    // Try the original validator first
    const originalValidator = this.registry.get(issue.validatorName);
    
    if (!originalValidator) {
      return { success: false, message: `Validator ${issue.validatorName} not found` };
    }

    // If the original validator can fix the issue, use it
    if (originalValidator.canFix && originalValidator.fix) {
      try {
        const result = originalValidator.fix(issue, context);
        return result;
      } catch (error) {
        return { 
          success: false, 
          message: `Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    }
    
    // If the original validator can't fix, but we have an AI suggestion, try to route to appropriate fixable validator
    if (issue.suggestedFix) {
      // Route based on issue category and AI suggestion content
      const fixableValidator = this.findAppropriateFixValidator(issue);
      if (fixableValidator && fixableValidator.canFix && fixableValidator.fix) {
        try {
          const result = fixableValidator.fix(issue, context);
          return result;
        } catch (error) {
          return { 
            success: false, 
            message: `AI fix failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          };
        }
      }
    }
    
    return { success: false, message: `Validator ${issue.validatorName} does not support fixing this issue` };
  }
  
  /**
   * Find an appropriate validator to handle an AI fix
   */
  private findAppropriateFixValidator(issue: ValidationIssue): IValidator | null {
    // For JSON format issues, use JSONValidator
    if (issue.category === 'format' && issue.suggestedFix?.includes('{')) {
      return this.registry.get('JSONValidator') || null;
    }
    
    // For header issues, check if it's adding vs. renaming
    if (issue.category === 'header') {
      const suggestion = issue.suggestedFix || '';
      
      // If suggestion mentions "Add missing" or "Add column", this is about adding new columns
      if (suggestion.includes('Add missing') || suggestion.includes('Add column')) {
        // Route to RequiredColumnsValidator or create a generic AI fix handler
        return this.createAIFixHandler();
      }
      
      // Otherwise, it's a header mapping/renaming issue
      return this.registry.get('HeaderMappingValidator') || null;
    }
    
    // For duplicate issues, use DuplicateIDValidator
    if (issue.message.toLowerCase().includes('duplicate')) {
      return this.registry.get('DuplicateIDValidator') || null;
    }
    
    return null;
  }
  
  /**
   * Create a generic AI fix handler for issues that don't have specific validators
   */
  private createAIFixHandler(): IValidator {
    return {
      name: 'AIFixHandler',
      category: 'schema' as const,
      priority: 999,
      enabled: true,
      canFix: true,
      validate: () => ({ issues: [], success: true, validatorName: 'AIFixHandler' }),
      fix: (issue, context) => this.handleGenericAIFix(issue, context)
    };
  }
  
  /**
   * Handle generic AI fixes that don't fit into specific validators
   */
  private handleGenericAIFix(issue: ValidationIssue, context: ValidationContext): FixResult {
    const suggestion = issue.suggestedFix || '';
    
    // Handle "Add missing column" suggestions
    if (suggestion.includes('Add missing') || suggestion.includes('Add column')) {
      return this.handleAddMissingColumn(issue, context, suggestion);
    }
    
    return { 
      success: false, 
      message: `Generic AI fix not implemented for: "${suggestion}"` 
    };
  }
  
  /**
   * Handle adding missing columns
   */
  private handleAddMissingColumn(issue: ValidationIssue, context: ValidationContext, suggestion: string): FixResult {
    // Extract column name from suggestion
    const fixMatch = suggestion.match(/💡\s*\*\*Fix\*\*:\s*([^\n\r]+)/);
    if (!fixMatch) {
      return { 
        success: false, 
        message: `Could not extract column name from suggestion: "${suggestion}"` 
      };
    }
    
    const columnName = fixMatch[1].trim();
    const data = ValidationContextHelper.getData(context, issue.sheet);
    
    if (!data) {
      return { success: false, message: 'No data found for sheet' };
    }
    
    // Check if column already exists
    if (data.headers.includes(columnName)) {
      return { 
        success: false, 
        message: `Column "${columnName}" already exists` 
      };
    }
    
    // Add the new column
    const modifiedData = {
      headers: [...data.headers, columnName],
      rows: data.rows.map(row => ({ ...row, [columnName]: '' })) // Add empty values
    };
    
    return {
      success: true,
      message: `Added missing column "${columnName}"`,
      modifiedData
    };
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalValidators: number;
    enabledValidators: number;
    categories: { [category: string]: number };
  } {
    const allValidators = this.registry.getAll();
    const enabledCount = allValidators.filter(v => v.enabled).length;
    
    const categories = allValidators.reduce((acc, validator) => {
      acc[validator.category] = (acc[validator.category] || 0) + 1;
      return acc;
    }, {} as { [category: string]: number });

    return {
      totalValidators: allValidators.length,
      enabledValidators: enabledCount,
      categories
    };
  }

  /**
   * Register a new validator
   */
  registerValidator(validator: IValidator): void {
    this.registry.register(validator);
  }

  /**
   * Get all issues from last validation run
   */
  getLastValidationResults(): ValidationIssue[] {
    return this.aggregator.getAllIssues();
  }

  /**
   * Clear all registered validators (useful for testing)
   */
  clearValidators(): void {
    this.registry.clear();
  }
}