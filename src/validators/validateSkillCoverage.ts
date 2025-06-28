import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

export function validateSkillCoverage(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  if (!data.tasks || !data.workers) return issues;

  // Get all required skills from tasks
  const requiredSkills = new Set<string>();
  for (const task of data.tasks.rows) {
    const skills = getColumnValue(task, 'RequiredSkills');
    if (skills && typeof skills === 'string') {
      skills.split(',').forEach(skill => requiredSkills.add(skill.trim().toLowerCase()));
    }
  }

  // Get all available skills from workers
  const availableSkills = new Set<string>();
  for (const worker of data.workers.rows) {
    const skills = getColumnValue(worker, 'Skills');
    if (skills && typeof skills === 'string') {
      skills.split(',').forEach(skill => availableSkills.add(skill.trim().toLowerCase()));
    }
  }

  // Check for uncovered skills
  for (const skill of requiredSkills) {
    if (!availableSkills.has(skill)) {
      issues.push(
        createValidationIssue(
          'skill_coverage',
          `Required skill '${skill}' is not available in any worker`,
          {
            type: 'warning',
            suggestion: `Add a worker with '${skill}' skill or remove tasks requiring this skill`,
            fixable: false,
          }
        )
      );
    }
  }

  return issues;
}