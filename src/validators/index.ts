import { ValidatorContext, ValidationResult, ValidationIssue } from './types';
import { createValidationResult } from './utils';

// Import all validators
import { validateMissingColumns } from './validateMissingColumns';
import { validateDuplicateIDs } from './validateDuplicateIDs';
import { validateMalformedLists } from './validateMalformedLists';
import { validateOutOfRange } from './validateOutOfRange';
import { validateJSONFields } from './validateJSONFields';
import { validateReferences } from './validateReferences';
import { validateCircularCoRun } from './validateCircularCoRun';
import { validateConflictingRules } from './validateConflictingRules';
import { validateOverloadedWorkers } from './validateOverloadedWorkers';
import { validatePhaseSaturation } from './validatePhaseSaturation';
import { validateSkillCoverage } from './validateSkillCoverage';
import { validateConcurrencyFeasibility } from './validateConcurrencyFeasibility';

const VALIDATORS = [
  validateMissingColumns,
  validateDuplicateIDs,
  validateMalformedLists,
  // validateOutOfRange,
  // validateJSONFields,
  // validateReferences,
  // validateCircularCoRun,
  // validateConflictingRules,
  // validateOverloadedWorkers,
  // validatePhaseSaturation,
  // validateSkillCoverage,
  // validateConcurrencyFeasibility,
];

export function runAllValidations(context: ValidatorContext): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  for (const validator of VALIDATORS) {
    try {
      const issues = validator(context);
      allIssues.push(...issues);
    } catch (error) {
      console.error(`Validator ${validator.name} failed:`, error);
      // Continue with other validators even if one fails
    }
  }

  return createValidationResult(allIssues);
}

// Export individual validators for testing and modularity
export {
  validateMissingColumns,
  validateDuplicateIDs,
  validateMalformedLists,
  validateOutOfRange,
  validateJSONFields,
  validateReferences,
  validateCircularCoRun,
  validateConflictingRules,
  validateOverloadedWorkers,
  validatePhaseSaturation,
  validateSkillCoverage,
  validateConcurrencyFeasibility,
};

// Export types and utils
export * from './types';
export * from './utils';