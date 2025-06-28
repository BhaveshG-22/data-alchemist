import { ValidatorContext, ValidationIssue } from './types';
import { createValidationIssue } from './utils';

export function validateCircularCoRun(context: ValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const coRunRules = context.rules?.filter(rule => rule.type === 'coRun') || [];

  // Build an undirected graph from coRun rules
  const graph = new Map<string, Set<string>>();
  for (const rule of coRunRules) {
    if (!rule.tasks || rule.tasks.length < 2) continue;

    for (let i = 0; i < rule.tasks.length; i++) {
      for (let j = i + 1; j < rule.tasks.length; j++) {
        const a = rule.tasks[i];
        const b = rule.tasks[j];

        if (!graph.has(a)) graph.set(a, new Set());
        if (!graph.has(b)) graph.set(b, new Set());

        graph.get(a)?.add(b);
        graph.get(b)?.add(a);
      }
    }
  }

  const visited = new Set<string>();
  const parent = new Map<string, string>();

  function dfs(task: string, prev: string | null, path: string[]): boolean {
    visited.add(task);
    path.push(task);

    const neighbors = graph.get(task) || [];
    for (const neighbor of neighbors) {
      if (neighbor === prev) continue; // skip back edge
      if (!visited.has(neighbor)) {
        parent.set(neighbor, task);
        if (dfs(neighbor, task, path)) return true;
      } else if (path.includes(neighbor)) {
        // Cycle detected
        const cycleStartIndex = path.indexOf(neighbor);
        const cycle = path.slice(cycleStartIndex).concat(neighbor);

        issues.push(
          createValidationIssue(
            'circular_corun',
            `Circular co-run group detected: ${cycle.join(' → ')}`,
            {
              type: 'error',
              suggestion: 'Break the cycle by removing one of the coRun rules between these tasks',
              fixable: false,
            }
          )
        );
        return true;
      }
    }

    path.pop();
    return false;
  }

  for (const task of graph.keys()) {
    if (!visited.has(task)) {
      const path: string[] = [];
      if (dfs(task, null, path)) break; // Report only first cycle found
    }
  }

  return issues;
}
