import { ValidationIssue, ValidationResult, FixResult, ParsedData } from '../types';

export class ValidationResultBuilder {
  private issues: ValidationIssue[] = [];
  private validatorName: string;
  private startTime: number;

  constructor(validatorName: string) {
    this.validatorName = validatorName;
    this.startTime = Date.now();
  }

  static create(validatorName: string): ValidationResultBuilder {
    return new ValidationResultBuilder(validatorName);
  }

  addIssue(issue: Omit<ValidationIssue, 'validatorName' | 'fixable'>): ValidationResultBuilder {
    this.issues.push({
      ...issue,
      validatorName: this.validatorName,
      fixable: false // Default to not fixable
    });
    return this;
  }

  addFixableIssue(issue: Omit<ValidationIssue, 'validatorName' | 'fixable'>): ValidationResultBuilder {
    this.issues.push({
      ...issue,
      validatorName: this.validatorName,
      fixable: true
    });
    return this;
  }

  addError(message: string, sheet: 'clients' | 'workers' | 'tasks', options?: {
    row?: number;
    column?: string;
    category?: ValidationIssue['category'];
    suggestedFix?: string;
    fixable?: boolean;
  }): ValidationResultBuilder {
    return this.addIssue({
      type: 'error',
      category: options?.category || 'data',
      message,
      sheet,
      row: options?.row,
      column: options?.column,
      severity: 'high',
      suggestedFix: options?.suggestedFix
    });
  }

  addWarning(message: string, sheet: 'clients' | 'workers' | 'tasks', options?: {
    row?: number;
    column?: string;
    category?: ValidationIssue['category'];
    suggestedFix?: string;
    fixable?: boolean;
  }): ValidationResultBuilder {
    const issueData = {
      type: 'warning' as const,
      category: options?.category || 'data',
      message,
      sheet,
      row: options?.row,
      column: options?.column,
      severity: 'medium' as const,
      suggestedFix: options?.suggestedFix
    };

    if (options?.fixable) {
      return this.addFixableIssue(issueData);
    } else {
      return this.addIssue(issueData);
    }
  }

  addInfo(message: string, sheet: 'clients' | 'workers' | 'tasks', options?: {
    row?: number;
    column?: string;
    category?: ValidationIssue['category'];
  }): ValidationResultBuilder {
    return this.addIssue({
      type: 'info',
      category: options?.category || 'data',
      message,
      sheet,
      row: options?.row,
      column: options?.column,
      severity: 'low'
    });
  }

  build(): ValidationResult {
    const executionTime = Date.now() - this.startTime;
    return {
      issues: this.issues,
      success: this.issues.filter(issue => issue.type === 'error').length === 0,
      validatorName: this.validatorName,
      executionTime
    };
  }
}

export class FixResultBuilder {
  static success(message: string, modifiedData?: ParsedData): FixResult {
    return {
      success: true,
      modifiedData,
      message
    };
  }

  static failure(message: string): FixResult {
    return {
      success: false,
      message
    };
  }
}

export class ValidationResultAggregator {
  private results: ValidationResult[] = [];

  add(result: ValidationResult): void {
    this.results.push(result);
  }

  getAllIssues(): ValidationIssue[] {
    return this.results.flatMap(result => result.issues);
  }

  getIssuesByCategory(category: ValidationIssue['category']): ValidationIssue[] {
    return this.getAllIssues().filter(issue => issue.category === category);
  }

  getIssuesBySheet(sheet: 'clients' | 'workers' | 'tasks'): ValidationIssue[] {
    return this.getAllIssues().filter(issue => issue.sheet === sheet);
  }

  getIssuesBySeverity(severity: 'high' | 'medium' | 'low'): ValidationIssue[] {
    return this.getAllIssues().filter(issue => issue.severity === severity);
  }

  getErrorCount(): number {
    return this.getAllIssues().filter(issue => issue.type === 'error').length;
  }

  getWarningCount(): number {
    return this.getAllIssues().filter(issue => issue.type === 'warning').length;
  }

  hasErrors(): boolean {
    return this.getErrorCount() > 0;
  }

  getExecutionSummary(): { totalTime: number; validatorCount: number; issueCount: number } {
    return {
      totalTime: this.results.reduce((sum, result) => sum + (result.executionTime || 0), 0),
      validatorCount: this.results.length,
      issueCount: this.getAllIssues().length
    };
  }
}