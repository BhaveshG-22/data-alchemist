import { ValidationIssue, ValidationResult } from './types';

export function createValidationIssue(
  category: ValidationIssue['category'],
  message: string,
  options: Partial<Omit<ValidationIssue, 'id' | 'category' | 'message'>> = {}
): ValidationIssue {
  return {
    id: generateIssueId(),
    category,
    message,
    type: options.type || 'error',
    ...options,
  };
}

export function generateIssueId(): string {
  return `issue_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function createValidationResult(issues: ValidationIssue[]): ValidationResult {
  const summary = {
    total: issues.length,
    errors: issues.filter(issue => issue.type === 'error').length,
    warnings: issues.filter(issue => issue.type === 'warning').length,
    info: issues.filter(issue => issue.type === 'info').length,
  };

  return {
    isValid: summary.errors === 0,
    issues,
    summary,
  };
}

export function parseJSON(value: unknown): { isValid: boolean; parsed?: unknown; error?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'Value is not a string' };
  }

  try {
    const parsed = JSON.parse(value);
    return { isValid: true, parsed };
  } catch (error) {
    return { isValid: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
}

export function normalizePhase(phase: string): string {
  return phase.toLowerCase().trim().replace(/\s+/g, '_');
}

export function parseNumericArray(value: unknown): { isValid: boolean; parsed?: number[]; error?: string } {
  if (!value) return { isValid: true, parsed: [] };
  
  if (typeof value === 'string') {
    try {
      // Handle comma-separated values
      const parts = value.split(',').map(s => s.trim()).filter(Boolean);
      const numbers = parts.map(part => {
        const num = parseFloat(part);
        if (isNaN(num)) throw new Error(`Invalid number: ${part}`);
        return num;
      });
      return { isValid: true, parsed: numbers };
    } catch (error) {
      return { isValid: false, error: error instanceof Error ? error.message : 'Invalid numeric array' };
    }
  }
  
  if (Array.isArray(value)) {
    const numbers = value.map(v => parseFloat(v));
    if (numbers.some(isNaN)) {
      return { isValid: false, error: 'Array contains non-numeric values' };
    }
    return { isValid: true, parsed: numbers };
  }
  
  return { isValid: false, error: 'Value must be a string or array' };
}

export function isInRange(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export function getColumnValue(row: Record<string, unknown>, column: string): unknown {
  return row[column];
}

export function findDuplicates<T>(array: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const duplicates: T[] = [];
  
  for (const item of array) {
    const key = keyFn(item);
    if (seen.has(key)) {
      duplicates.push(item);
    } else {
      seen.add(key);
    }
  }
  
  return duplicates;
}