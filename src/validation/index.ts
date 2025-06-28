// Main validation exports
export { ValidationEngine } from './ValidationEngine';
export { ValidationContextBuilder, ValidationContextHelper } from './utils/ValidationContext';
export { ValidationResultBuilder, ValidationResultAggregator } from './utils/ValidationResult';
export { ValidatorRegistry } from './utils/ValidatorRegistry';

// Types
export type { 
  ValidationIssue, 
  ValidationContext, 
  ValidationResult, 
  IValidator,
  FixResult,
  ParsedData,
  ValidationConfig
} from './types';

// Configuration
export { DATA_REQUIREMENTS, HEADER_PATTERNS, DEFAULT_VALIDATION_CONFIG } from './config/validationRules';

// Validators
export { RequiredColumnsValidator } from './validators/schema/RequiredColumnsValidator';
export { HeaderMappingValidator } from './validators/schema/HeaderMappingValidator';
export { DuplicateIDValidator } from './validators/schema/DuplicateIDValidator';
export { JSONValidator } from './validators/dataType/JSONValidator';
 
// Initialize validation system
import { ValidationEngine } from './ValidationEngine';
import { ValidatorRegistry } from './utils/ValidatorRegistry';

// Schema validators
import { RequiredColumnsValidator } from './validators/schema/RequiredColumnsValidator';
import { HeaderMappingValidator } from './validators/schema/HeaderMappingValidator';
import { DuplicateIDValidator } from './validators/schema/DuplicateIDValidator';

// Data type validators
import { JSONValidator } from './validators/dataType/JSONValidator';

/**
 * Initialize the validation system with all validators
 */
export function initializeValidationSystem(): ValidationEngine {
  const engine = new ValidationEngine();
  const registry = ValidatorRegistry.getInstance();

  // Clear any existing validators
  registry.clear();

  // Register schema validators
  registry.register(new RequiredColumnsValidator());
  registry.register(new HeaderMappingValidator());
  registry.register(new DuplicateIDValidator());

  // Register data type validators
  registry.register(new JSONValidator());

  console.log('🚀 Validation system initialized with validators:', registry.list());
  
  return engine;
}

/**
 * Create a new validation engine with default configuration
 */
export function createValidationEngine(): ValidationEngine {
  return initializeValidationSystem();
}

/**
 * Get all registered validators
 */
export function getRegisteredValidators(): string[] {
  return ValidatorRegistry.getInstance().list();
}

/**
 * Get validation system statistics
 */
export function getValidationStats() {
  const engine = new ValidationEngine();
  return engine.getValidationStats();
}