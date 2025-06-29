import { ValidatorContext, ValidationIssue, BusinessRule } from './types';
import { createValidationIssue } from './utils';

export function validateConflictingRules(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { rules } = context;

  if (!rules || rules.length === 0) return issues;

  // Group rules by type for easier processing
  const coRunRules = rules.filter(rule => rule.type === 'coRun' && rule.active);
  const phaseWindowRules = rules.filter(rule => rule.type === 'phaseWindow' && rule.active);
  const loadLimitRules = rules.filter(rule => rule.type === 'loadLimit' && rule.active);
  const slotRestrictionRules = rules.filter(rule => rule.type === 'slotRestriction' && rule.active);

  // Create a map of task ID to allowed phases (as strings for consistency)
  const taskPhaseConstraints = new Map<string, string[]>();
  for (const rule of phaseWindowRules) {
    if (rule.taskId && rule.allowedPhases) {
      taskPhaseConstraints.set(rule.taskId, rule.allowedPhases);
    } else if (rule.taskId && rule.phaseRange) {
      const phases = [];
      for (let i = rule.phaseRange.start; i <= rule.phaseRange.end; i++) {
        phases.push(i.toString());
      }
      taskPhaseConstraints.set(rule.taskId, phases);
    }
  }

  // 1. Check co-run vs phase-window conflicts
  for (const coRunRule of coRunRules) {
    if (!coRunRule.tasks || coRunRule.tasks.length < 2) continue;

    // Get phase constraints for all tasks in the co-run group
    const taskPhases = coRunRule.tasks.map(taskId => ({
      taskId,
      allowedPhases: taskPhaseConstraints.get(taskId) || []
    }));

    // Check if any tasks have phase constraints
    const constrainedTasks = taskPhases.filter(t => t.allowedPhases.length > 0);
    
    if (constrainedTasks.length > 1) {
      // Find intersection of all allowed phases
      const intersection = constrainedTasks.reduce((common, task) => {
        if (common.length === 0) return task.allowedPhases;
        return common.filter(phase => task.allowedPhases.includes(phase));
      }, [] as string[]);

      if (intersection.length === 0) {
        const taskList = constrainedTasks.map(t => t.taskId).join(', ');
        issues.push(
          createValidationIssue(
            'conflicting_rules',
            `Co-run rule conflicts with phase windows: tasks ${taskList} must run together but have no overlapping allowed phases`,
            {
              type: 'error',
              fixable: false,
              suggestion: `Adjust phase-window constraints so tasks ${taskList} can run in the same phase, or remove the co-run rule`,
            }
          )
        );
      }
    }
  }

  // 2. Check load-limit vs co-run conflicts
  for (const coRunRule of coRunRules) {
    if (!coRunRule.tasks || coRunRule.tasks.length < 2) continue;

    for (const loadRule of loadLimitRules) {
      if (!loadRule.maxSlotsPerPhase || !loadRule.workerGroup) continue;

      // Check if co-run tasks would exceed load limits
      // This is a simplified check - in practice, you'd need more context about task assignments
      if (coRunRule.tasks.length > loadRule.maxSlotsPerPhase) {
        issues.push(
          createValidationIssue(
            'conflicting_rules',
            `Co-run rule for ${coRunRule.tasks.length} tasks conflicts with load limit of ${loadRule.maxSlotsPerPhase} slots per phase for worker group "${loadRule.workerGroup}"`,
            {
              type: 'warning',
              fixable: false,
              suggestion: `Increase the load limit for worker group "${loadRule.workerGroup}" or reduce the co-run group size`,
            }
          )
        );
      }
    }
  }

  // 3. Check slot-restriction vs phase-window conflicts
  for (const slotRule of slotRestrictionRules) {
    if (!slotRule.targetGroup || !slotRule.minCommonSlots) continue;

    // Check if tasks have enough common slots based on phase windows
    for (const phaseRule of phaseWindowRules) {
      if (!phaseRule.taskId || !phaseRule.allowedPhases) continue;

      // This is a conceptual check - in practice, you'd need slot data
      if (phaseRule.allowedPhases && phaseRule.allowedPhases.length < slotRule.minCommonSlots) {
        issues.push(
          createValidationIssue(
            'conflicting_rules',
            `Phase window restriction for task ${phaseRule.taskId} (${phaseRule.allowedPhases.length} phases) conflicts with slot requirement (${slotRule.minCommonSlots} minimum common slots)`,
            {
              type: 'warning',
              fixable: false,
              suggestion: `Expand the phase window for task ${phaseRule.taskId} or reduce the common slot requirement`,
            }
          )
        );
      }
    }
  }

  // 4. Check for duplicate or contradictory rules for the same task
  const taskRuleMap = new Map<string, BusinessRule[]>();
  for (const rule of rules) {
    if (!rule.active) continue;
    
    let affectedTasks: string[] = [];
    if (rule.taskId) affectedTasks = [rule.taskId];
    if (rule.tasks) affectedTasks = rule.tasks;

    for (const taskId of affectedTasks) {
      if (!taskRuleMap.has(taskId)) {
        taskRuleMap.set(taskId, []);
      }
      taskRuleMap.get(taskId)!.push(rule);
    }
  }

  // Check for contradictory rules on the same task
  for (const [taskId, taskRules] of taskRuleMap) {
    const phaseWindowRulesForTask = taskRules.filter(r => r.type === 'phaseWindow');
    
    if (phaseWindowRulesForTask.length > 1) {
      // Multiple phase window rules for the same task - check for conflicts
      const allAllowedPhases = phaseWindowRulesForTask.map(rule => 
        rule.allowedPhases || (rule.phaseRange ? 
          Array.from({ length: rule.phaseRange.end - rule.phaseRange.start + 1 }, 
                     (_, i) => (rule.phaseRange!.start + i).toString()) : [])
      );

      if (allAllowedPhases.length > 1) {
        const intersection = allAllowedPhases.reduce((common, phases) => 
          common.filter(phase => phases.includes(phase))
        );

        if (intersection.length === 0) {
          issues.push(
            createValidationIssue(
              'conflicting_rules',
              `Task ${taskId} has conflicting phase window rules with no overlapping allowed phases`,
              {
                type: 'error',
                fixable: false,
                suggestion: `Remove conflicting phase window rules for task ${taskId} or adjust them to have overlapping phases`,
              }
            )
          );
        }
      }
    }
  }

  return issues;
}