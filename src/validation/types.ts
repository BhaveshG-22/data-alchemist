export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: 'header' | 'data' | 'format' | 'missing' | 'reference' | 'business' | 'constraint';
  message: string;
  sheet: 'clients' | 'workers' | 'tasks';
  row?: number;
  column?: string;
  severity: 'high' | 'medium' | 'low';
  suggestedFix?: string;
  validatorName: string;
  fixable: boolean;
}

export interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ValidationContext {
  clients: ParsedData | null;
  workers: ParsedData | null;
  tasks: ParsedData | null;
  config: ValidationConfig;
  requiredHeaders: {
    clients: string[];
    workers: string[];
    tasks: string[];
  };
}

export interface ValidationResult {
  issues: ValidationIssue[];
  success: boolean;
  validatorName: string;
  executionTime?: number;
}

export interface FixResult {
  success: boolean;
  modifiedData?: ParsedData;
  message: string;
}

export interface ValidationConfig {
  enabledValidators: string[];
  strictMode: boolean;
  autoFix: boolean;
  skipDependentValidators: boolean;
}

export interface IValidator {
  name: string;
  category: 'schema' | 'dataType' | 'crossReference' | 'businessLogic' | 'constraint';
  priority: number; // Lower numbers run first
  enabled: boolean;
  dependencies?: string[]; // Names of validators this depends on
  
  validate(context: ValidationContext): ValidationResult;
  canFix?: boolean;
  fix?(issue: ValidationIssue, context: ValidationContext): FixResult;
}

// Data structure requirements
export interface DataRequirements {
  clients: {
    required: string[];
    types: Record<string, 'string' | 'number' | 'json' | 'array'>;
    ranges: Record<string, { min?: number; max?: number }>;
  };
  workers: {
    required: string[];
    types: Record<string, 'string' | 'number' | 'json' | 'array'>;
    ranges: Record<string, { min?: number; max?: number }>;
  };
  tasks: {
    required: string[];
    types: Record<string, 'string' | 'number' | 'json' | 'array'>;
    ranges: Record<string, { min?: number; max?: number }>;
  };
}