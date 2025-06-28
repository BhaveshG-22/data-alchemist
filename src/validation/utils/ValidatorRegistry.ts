import { IValidator, ValidationContext } from '../types';
import { ValidationContextHelper } from './ValidationContext';

export class ValidatorRegistry {
  private validators: Map<string, IValidator> = new Map();
  private static instance: ValidatorRegistry;

  static getInstance(): ValidatorRegistry {
    if (!ValidatorRegistry.instance) {
      ValidatorRegistry.instance = new ValidatorRegistry();
    }
    return ValidatorRegistry.instance;
  }

  register(validator: IValidator): void {
    if (this.validators.has(validator.name)) {
      console.warn(`Validator ${validator.name} is already registered. Overwriting.`);
    }
    this.validators.set(validator.name, validator);
  }

  unregister(validatorName: string): boolean {
    return this.validators.delete(validatorName);
  }

  get(validatorName: string): IValidator | undefined {
    return this.validators.get(validatorName);
  }

  getAll(): IValidator[] {
    return Array.from(this.validators.values());
  }

  getByCategory(category: IValidator['category']): IValidator[] {
    return this.getAll().filter(validator => validator.category === category);
  }

  getEnabled(context: ValidationContext): IValidator[] {
    return this.getAll().filter(validator => 
      validator.enabled && 
      ValidationContextHelper.isValidatorEnabled(context, validator.name)
    );
  }

  getSortedByPriority(validators: IValidator[]): IValidator[] {
    return validators.sort((a, b) => a.priority - b.priority);
  }

  resolveDependencies(validators: IValidator[]): IValidator[] {
    const resolved: IValidator[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (validator: IValidator) => {
      if (visited.has(validator.name)) return;
      if (visiting.has(validator.name)) {
        throw new Error(`Circular dependency detected involving ${validator.name}`);
      }

      visiting.add(validator.name);

      if (validator.dependencies) {
        for (const depName of validator.dependencies) {
          const dependency = this.get(depName);
          if (dependency && validators.includes(dependency)) {
            visit(dependency);
          }
        }
      }

      visiting.delete(validator.name);
      visited.add(validator.name);
      
      if (!resolved.includes(validator)) {
        resolved.push(validator);
      }
    };

    validators.forEach(visit);
    return resolved;
  }

  getExecutionOrder(context: ValidationContext): IValidator[] {
    const enabledValidators = this.getEnabled(context);
    const sortedValidators = this.getSortedByPriority(enabledValidators);
    return this.resolveDependencies(sortedValidators);
  }

  clear(): void {
    this.validators.clear();
  }

  list(): string[] {
    return Array.from(this.validators.keys());
  }

  count(): number {
    return this.validators.size;
  }
}