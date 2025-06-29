import { useState, useCallback, useMemo } from 'react';

interface CommandTemplate {
  id: string;
  name: string;
  command: string;
  description: string;
  category: 'filter' | 'update' | 'delete' | 'add' | 'transform';
  variables?: string[]; // Variables that can be customized
}

interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

const DEFAULT_TEMPLATES: CommandTemplate[] = [
  {
    id: 'set_priority_level',
    name: 'Set Priority Level',
    command: 'Set all {field} with value {oldValue} to {newValue}',
    description: 'Change priority levels for specific conditions',
    category: 'update',
    variables: ['field', 'oldValue', 'newValue']
  },
  {
    id: 'add_phase',
    name: 'Add Phase to Tasks',
    command: 'Add phase {phase} to all tasks where {field} includes {value}',
    description: 'Add phases to tasks based on conditions',
    category: 'update',
    variables: ['phase', 'field', 'value']
  },
  {
    id: 'remove_task_from_requests',
    name: 'Remove Task from Requests',
    command: 'Remove task {taskId} from all {field}',
    description: 'Remove specific tasks from request lists',
    category: 'update',
    variables: ['taskId', 'field']
  },
  {
    id: 'delete_inactive',
    name: 'Delete Inactive Records',
    command: 'Delete all rows where {field} is "{value}"',
    description: 'Remove records with specific status',
    category: 'delete',
    variables: ['field', 'value']
  },
  {
    id: 'update_skill_capacity',
    name: 'Update Skill-based Capacity',
    command: 'Update all workers with {skill} skill to have {field} of {value}',
    description: 'Modify capacity based on skills',
    category: 'update',
    variables: ['skill', 'field', 'value']
  },
  {
    id: 'set_group_priority',
    name: 'Set Group Priority',
    command: 'Set all clients in {group} to {field} {value}',
    description: 'Bulk update group priorities',
    category: 'update',
    variables: ['group', 'field', 'value']
  }
];

export function useCommandTemplates(data?: ParsedData) {
  const [customTemplates, setCustomTemplates] = useState<CommandTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Generate smart suggestions based on data
  const smartSuggestions = useMemo(() => {
    if (!data) return [];

    const suggestions: CommandTemplate[] = [];
    
    // Analyze data to create contextual templates
    data.headers.forEach(header => {
      // Find unique values for categorical fields
      const uniqueValues = [...new Set(data.rows.map(row => row[header]))];
      
      if (uniqueValues.length > 1 && uniqueValues.length < 20) {
        // Create templates for fields with reasonable number of unique values
        if (header.toLowerCase().includes('priority') || 
            header.toLowerCase().includes('level') ||
            header.toLowerCase().includes('status')) {
          uniqueValues.forEach((value, index) => {
            if (index < 3) { // Limit suggestions
              suggestions.push({
                id: `smart_${header}_${index}`,
                name: `Update ${header}`,
                command: `Set all ${header} with value "${value}" to [NEW_VALUE]`,
                description: `Change ${header} from "${value}" to a new value`,
                category: 'update',
                variables: ['NEW_VALUE']
              });
            }
          });
        }
      }
    });

    return suggestions.slice(0, 5); // Limit smart suggestions
  }, [data]);

  const allTemplates = useMemo(() => {
    return [...DEFAULT_TEMPLATES, ...smartSuggestions, ...customTemplates];
  }, [smartSuggestions, customTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) return allTemplates;
    
    const term = searchTerm.toLowerCase();
    return allTemplates.filter(template =>
      template.name.toLowerCase().includes(term) ||
      template.description.toLowerCase().includes(term) ||
      template.command.toLowerCase().includes(term) ||
      template.category.includes(term)
    );
  }, [allTemplates, searchTerm]);

  const getTemplatesByCategory = useCallback((category: string) => {
    return filteredTemplates.filter(template => template.category === category);
  }, [filteredTemplates]);

  const saveCustomTemplate = useCallback((template: Omit<CommandTemplate, 'id'>) => {
    const newTemplate: CommandTemplate = {
      ...template,
      id: `custom_${Date.now()}`
    };
    setCustomTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  }, []);

  const deleteCustomTemplate = useCallback((id: string) => {
    setCustomTemplates(prev => prev.filter(template => template.id !== id));
  }, []);

  const fillTemplate = useCallback((template: CommandTemplate, variables: Record<string, string>) => {
    let filledCommand = template.command;
    
    if (template.variables) {
      template.variables.forEach(variable => {
        const value = variables[variable] || `{${variable}}`;
        filledCommand = filledCommand.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
      });
    }
    
    return filledCommand;
  }, []);

  // Extract suggested values from data for template variables
  const getSuggestedValues = useCallback((variable: string) => {
    if (!data) return [];
    
    const suggestions: string[] = [];
    
    // Field suggestions
    if (variable === 'field') {
      return data.headers;
    }
    
    // Value suggestions based on common patterns
    data.headers.forEach(header => {
      if (header.toLowerCase().includes(variable.toLowerCase())) {
        const values = [...new Set(data.rows.map(row => String(row[header])))];
        suggestions.push(...values.slice(0, 5));
      }
    });
    
    return [...new Set(suggestions)];
  }, [data]);

  return {
    // Templates
    allTemplates,
    filteredTemplates,
    getTemplatesByCategory,
    smartSuggestions,
    
    // Search
    searchTerm,
    setSearchTerm,
    
    // Custom templates
    saveCustomTemplate,
    deleteCustomTemplate,
    customTemplates,
    
    // Template utilities
    fillTemplate,
    getSuggestedValues,
    
    // Categories
    categories: ['filter', 'update', 'delete', 'add', 'transform'] as const,
  };
}