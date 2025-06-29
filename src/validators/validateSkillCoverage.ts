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
        .filter(Boolean)
        .forEach(skill => availableSkills.add(skill));
    }
  }

  // Check every RequiredSkill in tasks
  for (let i = 0; i < data.tasks.rows.length; i++) {
    const row = data.tasks.rows[i];
    const taskID = getColumnValue(row, 'TaskID') as string;
    const skills = getColumnValue(row, 'RequiredSkills');

    if (skills && typeof skills === 'string') {
      const requiredList = skills
        .split(',')
        .map(skill => skill.trim().toLowerCase())
        .filter(Boolean);

      for (const skill of requiredList) {
        if (!availableSkills.has(skill)) {
          const taskInfo = taskID ? ` (${taskID})` : '';
          issues.push(
            createValidationIssue(
              'skill_coverage',
              `No worker has the skill "${skill}" required by task${taskInfo}`,
              {
                sheet: 'tasks',
                row: i + 1,
                column: 'RequiredSkills',
                value: skill,
                type: 'error',
                suggestion: `Add a worker with the "${skill}" skill or update the task requirements`,
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
