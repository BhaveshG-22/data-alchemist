import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue, getColumnValue } from './utils';

export function validateSkillCoverage(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data } = context;

  if (!data.tasks || !data.workers) return issues;

  // Get all available skills from workers
  const availableSkills = new Set<string>();
  for (const worker of data.workers.rows) {
    const skills = getColumnValue(worker, 'Skills');
    if (skills && typeof skills === 'string') {
      skills
        .split(',')
        .map(skill => skill.trim().toLowerCase())
        .forEach(skill => availableSkills.add(skill));
    }
  }

  // Check every RequiredSkill in tasks
  for (let i = 0; i < data.tasks.rows.length; i++) {
    const row = data.tasks.rows[i];
    const skills = getColumnValue(row, 'RequiredSkills');

    if (skills && typeof skills === 'string') {
      const requiredList = skills
        .split(',')
        .map(skill => skill.trim().toLowerCase())
        .filter(Boolean);

      for (const skill of requiredList) {
        if (!availableSkills.has(skill)) {
          issues.push(
            createValidationIssue(
              'skill_coverage',
              `Required skill '${skill}' in task at row ${i + 1} is not available in any worker`,
              {
                sheet: 'tasks',
                row: i + 1,
                column: 'RequiredSkills',
                value: skill,
                type: 'warning',
                suggestion: `Add a worker with '${skill}' skill or remove this task requirement`,
                fixable: false,
              }
            )
          );
        }
      }
    }
  }

  return issues;
}
