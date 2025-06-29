import { BusinessRule } from './types';

export interface NLRuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedRule?: BusinessRule;
}

export function validateNLGeneratedRule(
  rule: any,
  availableTasks: string[] = [],
  availableClientGroups: string[] = [],
  availableWorkerGroups: string[] = []
): NLRuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic structure validation
  if (!rule || typeof rule !== 'object') {
    return {
      isValid: false,
      errors: ['Rule must be a valid object'],
      warnings: []
    };
  }

  if (!rule.type) {
    errors.push('Rule must have a type');
  } else if (!['coRun', 'slotRestriction', 'loadLimit', 'phaseWindow', 'precedence'].includes(rule.type)) {
    errors.push(`Invalid rule type: ${rule.type}`);
  }

  // Type-specific validation
  switch (rule.type) {
    case 'coRun':
      if (!rule.tasks || !Array.isArray(rule.tasks)) {
        errors.push('Co-run rules must have a tasks array');
      } else {
        if (rule.tasks.length < 2) {
          errors.push('Co-run rules require at least 2 tasks');
        }
        
        // Validate task IDs exist
        if (availableTasks.length > 0) {
          const invalidTasks = rule.tasks.filter((task: string) => !availableTasks.includes(task));
          if (invalidTasks.length > 0) {
            warnings.push(`Some tasks may not exist: ${invalidTasks.join(', ')}`);
          }
        }
      }
      break;

    case 'slotRestriction':
      if (!rule.group) {
        errors.push('Slot restriction rules must have a group');
      } else {
        // Check if group exists in available groups
        const allGroups = [...availableClientGroups, ...availableWorkerGroups];
        if (allGroups.length > 0 && !allGroups.includes(rule.group)) {
          warnings.push(`Group "${rule.group}" may not exist in the system`);
        }
      }
      
      if (typeof rule.minCommonSlots !== 'number' || rule.minCommonSlots < 1) {
        errors.push('Slot restriction rules must have a valid minCommonSlots (positive integer)');
      }
      break;

    case 'loadLimit':
      if (!rule.group) {
        errors.push('Load limit rules must have a group');
      } else {
        // Check if group exists in worker groups
        if (availableWorkerGroups.length > 0 && !availableWorkerGroups.includes(rule.group)) {
          warnings.push(`Worker group "${rule.group}" may not exist in the system`);
        }
      }
      
      if (typeof rule.maxSlotsPerPhase !== 'number' || rule.maxSlotsPerPhase < 1) {
        errors.push('Load limit rules must have a valid maxSlotsPerPhase (positive integer)');
      }
      break;

    case 'phaseWindow':
      if (!rule.task) {
        errors.push('Phase window rules must have a task');
      } else {
        // Validate task ID exists
        if (availableTasks.length > 0 && !availableTasks.includes(rule.task)) {
          warnings.push(`Task "${rule.task}" may not exist in the system`);
        }
      }
      
      const hasPhases = rule.phases && Array.isArray(rule.phases);
      const hasPhaseRange = rule.phaseRange && 
                           typeof rule.phaseRange.start === 'number' && 
                           typeof rule.phaseRange.end === 'number';
      
      if (!hasPhases && !hasPhaseRange) {
        errors.push('Phase window rules must have either phases array or phaseRange object');
      } else if (hasPhases && hasPhaseRange) {
        warnings.push('Phase window rules should have either phases OR phaseRange, not both');
      }
      
      if (hasPhases) {
        const invalidPhases = rule.phases.filter((phase: number) => phase < 1 || phase > 5);
        if (invalidPhases.length > 0) {
          errors.push('Phase numbers must be between 1 and 5');
        }
      }
      
      if (hasPhaseRange) {
        if (rule.phaseRange.start < 1 || rule.phaseRange.end > 5 || rule.phaseRange.start >= rule.phaseRange.end) {
          errors.push('Phase range must be valid (start < end, within 1-5)');
        }
      }
      break;

    case 'precedence':
      if (!rule.before || !rule.after) {
        errors.push('Precedence rules must have both before and after tasks');
      } else {
        if (rule.before === rule.after) {
          errors.push('Precedence rules cannot have the same task for before and after');
        }
        
        // Validate task IDs exist
        if (availableTasks.length > 0) {
          if (!availableTasks.includes(rule.before)) {
            warnings.push(`Before task "${rule.before}" may not exist in the system`);
          }
          if (!availableTasks.includes(rule.after)) {
            warnings.push(`After task "${rule.after}" may not exist in the system`);
          }
        }
      }
      break;
  }

  // Create normalized rule if valid
  let normalizedRule: BusinessRule | undefined;
  if (errors.length === 0) {
    normalizedRule = {
      id: `rule_${Date.now()}`,
      type: rule.type,
      description: rule.description || `Generated rule for ${rule.type}`,
      active: true,
      priority: rule.priority || 1,
      ...rule
    };

    // Normalize based on type
    switch (rule.type) {
      case 'slotRestriction':
        // Add default groupType if not specified
        if (!normalizedRule.groupType) {
          normalizedRule.groupType = availableClientGroups.includes(rule.group) ? 'client' : 'worker';
        }
        // Map group to appropriate field names for compatibility
        normalizedRule.targetGroup = rule.group;
        normalizedRule.minCommonSlots = rule.minCommonSlots;
        break;
        
      case 'loadLimit':
        // Map group to workerGroup for compatibility
        normalizedRule.workerGroup = rule.group;
        normalizedRule.maxSlotsPerPhase = rule.maxSlotsPerPhase;
        break;
        
      case 'phaseWindow':
        // Map task to taskId for compatibility
        normalizedRule.taskId = rule.task;
        if (rule.phases) {
          // Convert numeric phases to Phase strings for compatibility
          normalizedRule.allowedPhases = rule.phases.map((p: number) => `Phase ${p}`);
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalizedRule
  };
}

export function sanitizeNLRuleInput(input: string): string {
  // Clean and normalize the input
  return input
    .trim()
    .replace(/[^\w\s,\-()]/g, '') // Remove special characters except basic ones
    .replace(/\s+/g, ' ') // Normalize whitespace
    .toLowerCase();
}

export function extractTaskIdsFromInput(input: string, availableTasks: string[]): string[] {
  const foundTasks: string[] = [];
  
  // Look for task patterns in the input
  availableTasks.forEach(taskId => {
    const patterns = [
      new RegExp(`\\b${taskId}\\b`, 'i'),
      new RegExp(`task\\s+${taskId}`, 'i'),
      new RegExp(`${taskId.toLowerCase()}`, 'i')
    ];
    
    if (patterns.some(pattern => pattern.test(input))) {
      foundTasks.push(taskId);
    }
  });
  
  return foundTasks;
}

export function extractGroupsFromInput(
  input: string, 
  availableClientGroups: string[], 
  availableWorkerGroups: string[]
): { clientGroups: string[], workerGroups: string[] } {
  const foundClientGroups: string[] = [];
  const foundWorkerGroups: string[] = [];
  
  // Look for group patterns in the input
  availableClientGroups.forEach(group => {
    const patterns = [
      new RegExp(`\\b${group}\\b`, 'i'),
      new RegExp(`group\\s+${group}`, 'i'),
      new RegExp(`${group.toLowerCase()}`, 'i')
    ];
    
    if (patterns.some(pattern => pattern.test(input))) {
      foundClientGroups.push(group);
    }
  });
  
  availableWorkerGroups.forEach(group => {
    const patterns = [
      new RegExp(`\\b${group}\\b`, 'i'),
      new RegExp(`group\\s+${group}`, 'i'),
      new RegExp(`${group.toLowerCase()}`, 'i')
    ];
    
    if (patterns.some(pattern => pattern.test(input))) {
      foundWorkerGroups.push(group);
    }
  });
  
  return { clientGroups: foundClientGroups, workerGroups: foundWorkerGroups };
}