export interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'missing_columns' | 'duplicate_ids' | 'malformed_lists' | 'out_of_range' | 'json_fields' | 'references' | 'circular_corun' | 'conflicting_rules' | 'overloaded_workers' | 'phase_saturation' | 'skill_coverage' | 'concurrency_feasibility';
  message: string;
  sheet?: string;
  row?: number;
  column?: string;
  value?: unknown;
  suggestion?: string;
  fixable?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
  };
}

export interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ParsedData {
  clients?: SheetData;
  workers?: SheetData;
  tasks?: SheetData;
  [key: string]: SheetData | undefined;
}

export interface ValidatorContext {
  data: ParsedData;
  config?: ValidationConfig;
}

export interface ValidationConfig {
  strictMode?: boolean;
  autoFix?: boolean;
  skipWarnings?: boolean;
  customRules?: Record<string, unknown>;
}

export type ValidatorFunction = (context: ValidatorContext) => ValidationIssue[];