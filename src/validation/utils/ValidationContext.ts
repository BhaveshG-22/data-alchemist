import { ValidationContext, ParsedData, ValidationConfig } from '../types';
import { DATA_REQUIREMENTS, DEFAULT_VALIDATION_CONFIG } from '../config/validationRules';

export class ValidationContextBuilder {
  private context: Partial<ValidationContext> = {};

  static create(): ValidationContextBuilder {
    return new ValidationContextBuilder();
  }

  withClients(data: ParsedData | null): ValidationContextBuilder {
    this.context.clients = data;
    return this;
  }

  withWorkers(data: ParsedData | null): ValidationContextBuilder {
    this.context.workers = data;
    return this;
  }

  withTasks(data: ParsedData | null): ValidationContextBuilder {
    this.context.tasks = data;
    return this;
  }

  withConfig(config: Partial<ValidationConfig>): ValidationContextBuilder {
    this.context.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
    return this;
  }

  build(): ValidationContext {
    return {
      clients: this.context.clients || null,
      workers: this.context.workers || null,
      tasks: this.context.tasks || null,
      config: this.context.config || DEFAULT_VALIDATION_CONFIG,
      requiredHeaders: {
        clients: DATA_REQUIREMENTS.clients.required,
        workers: DATA_REQUIREMENTS.workers.required,
        tasks: DATA_REQUIREMENTS.tasks.required
      }
    };
  }
}

export class ValidationContextHelper {
  static hasData(context: ValidationContext, sheet: 'clients' | 'workers' | 'tasks'): boolean {
    return context[sheet] !== null && context[sheet]!.rows.length > 0;
  }

  static getData(context: ValidationContext, sheet: 'clients' | 'workers' | 'tasks'): ParsedData | null {
    return context[sheet];
  }

  static getAllData(context: ValidationContext): { clients: ParsedData | null; workers: ParsedData | null; tasks: ParsedData | null } {
    return {
      clients: context.clients,
      workers: context.workers,
      tasks: context.tasks
    };
  }

  static getRequiredHeaders(context: ValidationContext, sheet: 'clients' | 'workers' | 'tasks'): string[] {
    return context.requiredHeaders[sheet];
  }

  static isValidatorEnabled(context: ValidationContext, validatorName: string): boolean {
    return context.config.enabledValidators.includes(validatorName);
  }

  static shouldAutoFix(context: ValidationContext): boolean {
    return context.config.autoFix;
  }

  static isStrictMode(context: ValidationContext): boolean {
    return context.config.strictMode;
  }
}