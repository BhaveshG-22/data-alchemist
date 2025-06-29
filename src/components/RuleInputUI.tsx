'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faEdit, faSave, faTimes, faDownload } from '@fortawesome/free-solid-svg-icons';
import { BusinessRule } from '@/validators/types';

interface RuleInputUIProps {
  rules: BusinessRule[];
  onRulesChange: (rules: BusinessRule[]) => void;
  availableTasks: string[];
  availableClientGroups?: string[];
  availableWorkerGroups?: string[];
}

interface RuleFormData {
  type: BusinessRule['type'];
  description: string;
  active: boolean;
  priority: number;
  
  // Co-run specific
  tasks: string[];
  
  // Slot-restriction specific
  targetGroup: string;
  groupType: 'client' | 'worker';
  minCommonSlots: number;
  
  // Load-limit specific
  workerGroup: string;
  maxSlotsPerPhase: number;
  
  // Phase-window specific
  taskId: string;
  allowedPhases: string[];
  phaseRange: { start: number; end: number };
  usePhaseRange: boolean;
  
  // Pattern-match specific
  pattern: string;
  ruleTemplate: string;
  parameters: Record<string, string>;
  
  // Precedence override specific
  scope: 'global' | 'specific';
  overrides: string[];
}

export default function RuleInputUI({ 
  rules, 
  onRulesChange, 
  availableTasks,
  availableClientGroups = [],
  availableWorkerGroups = []
}: RuleInputUIProps) {
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [formData, setFormData] = useState<RuleFormData>({
    type: 'coRun',
    description: '',
    active: true,
    priority: 1,
    tasks: [],
    targetGroup: '',
    groupType: 'client',
    minCommonSlots: 1,
    workerGroup: '',
    maxSlotsPerPhase: 1,
    taskId: '',
    allowedPhases: [],
    phaseRange: { start: 1, end: 5 },
    usePhaseRange: false,
    pattern: '',
    ruleTemplate: 'custom',
    parameters: {},
    scope: 'global',
    overrides: []
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ruleTypeLabels = {
    coRun: 'Co-Run Tasks',
    slotRestriction: 'Slot Restriction',
    loadLimit: 'Load Limit',
    phaseWindow: 'Phase Window',
    patternMatch: 'Pattern Match',
    precedenceOverride: 'Precedence Override'
  };

  const ruleTypeIcons = {
    coRun: '🔗',
    slotRestriction: '⏰',
    loadLimit: '⚖️',
    phaseWindow: '📅',
    patternMatch: '🔍',
    precedenceOverride: '⭐'
  };

  const ruleTypeDescriptions = {
    coRun: 'Tasks that must be scheduled to run at the same time',
    slotRestriction: 'Minimum common time slots required for groups',
    loadLimit: 'Maximum workload per phase for worker groups',
    phaseWindow: 'Allowed phases or time windows for specific tasks',
    patternMatch: 'Custom rules based on regex patterns',
    precedenceOverride: 'Priority overrides for rule conflicts'
  };

  const phaseOptions = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'];
  const ruleTemplates = ['custom', 'resource-constraint', 'time-dependency', 'skill-requirement'];

  const resetForm = () => {
    setFormData({
      type: 'coRun',
      description: '',
      active: true,
      priority: 1,
      tasks: [],
      targetGroup: '',
      groupType: 'client',
      minCommonSlots: 1,
      workerGroup: '',
      maxSlotsPerPhase: 1,
      taskId: '',
      allowedPhases: [],
      phaseRange: { start: 1, end: 5 },
      usePhaseRange: false,
      pattern: '',
      ruleTemplate: 'custom',
      parameters: {},
      scope: 'global',
      overrides: []
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Please provide a description';
    }

    switch (formData.type) {
      case 'coRun':
        if (formData.tasks.length < 2) {
          newErrors.tasks = 'Co-run rules require at least 2 tasks';
        }
        break;
        
      case 'slotRestriction':
        if (!formData.targetGroup.trim()) {
          newErrors.targetGroup = 'Please select a target group';
        }
        if (formData.minCommonSlots < 1) {
          newErrors.minCommonSlots = 'Minimum common slots must be at least 1';
        }
        break;
        
      case 'loadLimit':
        if (!formData.workerGroup.trim()) {
          newErrors.workerGroup = 'Please select a worker group';
        }
        if (formData.maxSlotsPerPhase < 1) {
          newErrors.maxSlotsPerPhase = 'Maximum slots per phase must be at least 1';
        }
        break;
        
      case 'phaseWindow':
        if (!formData.taskId.trim()) {
          newErrors.taskId = 'Please select a task';
        }
        if (!formData.usePhaseRange && formData.allowedPhases.length === 0) {
          newErrors.allowedPhases = 'Please select at least one allowed phase';
        }
        if (formData.usePhaseRange && formData.phaseRange.start >= formData.phaseRange.end) {
          newErrors.phaseRange = 'Phase range start must be less than end';
        }
        break;
        
      case 'patternMatch':
        if (!formData.pattern.trim()) {
          newErrors.pattern = 'Please enter a regex pattern';
        }
        try {
          new RegExp(formData.pattern);
        } catch {
          newErrors.pattern = 'Invalid regex pattern';
        }
        break;
        
      case 'precedenceOverride':
        if (formData.scope === 'specific' && formData.overrides.length === 0) {
          newErrors.overrides = 'Please select rules to override';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddRule = () => {
    if (!validateForm()) return;

    const newRule: BusinessRule = {
      id: `rule_${Date.now()}`,
      type: formData.type,
      description: formData.description,
      active: formData.active,
      priority: formData.priority
    };

    // Add type-specific properties
    switch (formData.type) {
      case 'coRun':
        newRule.tasks = [...formData.tasks];
        break;
      case 'slotRestriction':
        newRule.targetGroup = formData.targetGroup;
        newRule.groupType = formData.groupType;
        newRule.minCommonSlots = formData.minCommonSlots;
        break;
      case 'loadLimit':
        newRule.workerGroup = formData.workerGroup;
        newRule.maxSlotsPerPhase = formData.maxSlotsPerPhase;
        break;
      case 'phaseWindow':
        newRule.taskId = formData.taskId;
        if (formData.usePhaseRange) {
          newRule.phaseRange = { ...formData.phaseRange };
        } else {
          newRule.allowedPhases = [...formData.allowedPhases];
        }
        break;
      case 'patternMatch':
        newRule.pattern = formData.pattern;
        newRule.ruleTemplate = formData.ruleTemplate;
        newRule.parameters = { ...formData.parameters };
        break;
      case 'precedenceOverride':
        newRule.scope = formData.scope;
        newRule.overrides = [...formData.overrides];
        break;
    }

    onRulesChange([...rules, newRule]);
    resetForm();
    setIsAddingRule(false);
  };

  const handleEditRule = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      setFormData({
        type: rule.type,
        description: rule.description || '',
        active: rule.active,
        priority: rule.priority || 1,
        tasks: rule.tasks || [],
        targetGroup: rule.targetGroup || '',
        groupType: rule.groupType || 'client',
        minCommonSlots: rule.minCommonSlots || 1,
        workerGroup: rule.workerGroup || '',
        maxSlotsPerPhase: rule.maxSlotsPerPhase || 1,
        taskId: rule.taskId || '',
        allowedPhases: rule.allowedPhases || [],
        phaseRange: rule.phaseRange || { start: 1, end: 5 },
        usePhaseRange: !!rule.phaseRange,
        pattern: rule.pattern || '',
        ruleTemplate: rule.ruleTemplate || 'custom',
        parameters: rule.parameters || {},
        scope: rule.scope || 'global',
        overrides: rule.overrides || []
      });
      setEditingRule(ruleId);
      setIsAddingRule(true);
    }
  };

  const handleUpdateRule = () => {
    if (!validateForm() || !editingRule) return;

    const updatedRules = rules.map(rule => 
      rule.id === editingRule 
        ? {
            ...rule,
            type: formData.type,
            description: formData.description,
            active: formData.active,
            priority: formData.priority,
            // Clear all optional fields first
            tasks: undefined,
            targetGroup: undefined,
            groupType: undefined,
            minCommonSlots: undefined,
            workerGroup: undefined,
            maxSlotsPerPhase: undefined,
            taskId: undefined,
            allowedPhases: undefined,
            phaseRange: undefined,
            pattern: undefined,
            ruleTemplate: undefined,
            parameters: undefined,
            scope: undefined,
            overrides: undefined,
            // Then set type-specific fields
            ...(formData.type === 'coRun' && { tasks: [...formData.tasks] }),
            ...(formData.type === 'slotRestriction' && { 
              targetGroup: formData.targetGroup,
              groupType: formData.groupType,
              minCommonSlots: formData.minCommonSlots
            }),
            ...(formData.type === 'loadLimit' && { 
              workerGroup: formData.workerGroup,
              maxSlotsPerPhase: formData.maxSlotsPerPhase
            }),
            ...(formData.type === 'phaseWindow' && { 
              taskId: formData.taskId,
              ...(formData.usePhaseRange 
                ? { phaseRange: { ...formData.phaseRange } }
                : { allowedPhases: [...formData.allowedPhases] }
              )
            }),
            ...(formData.type === 'patternMatch' && { 
              pattern: formData.pattern,
              ruleTemplate: formData.ruleTemplate,
              parameters: { ...formData.parameters }
            }),
            ...(formData.type === 'precedenceOverride' && { 
              scope: formData.scope,
              overrides: [...formData.overrides]
            })
          }
        : rule
    );

    onRulesChange(updatedRules);
    resetForm();
    setIsAddingRule(false);
    setEditingRule(null);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = rules.filter(rule => rule.id !== ruleId);
    onRulesChange(updatedRules);
  };

  const handleToggleActive = (ruleId: string) => {
    const updatedRules = rules.map(rule =>
      rule.id === ruleId ? { ...rule, active: !rule.active } : rule
    );
    onRulesChange(updatedRules);
  };

  const handleCancel = () => {
    resetForm();
    setIsAddingRule(false);
    setEditingRule(null);
  };

  const handleGenerateRulesConfig = () => {
    const rulesConfig = {
      version: "1.0",
      generated: new Date().toISOString(),
      rules: rules.map(rule => ({
        id: rule.id,
        type: rule.type,
        description: rule.description,
        active: rule.active,
        priority: rule.priority,
        ...(rule.tasks && { tasks: rule.tasks }),
        ...(rule.targetGroup && { targetGroup: rule.targetGroup }),
        ...(rule.groupType && { groupType: rule.groupType }),
        ...(rule.minCommonSlots && { minCommonSlots: rule.minCommonSlots }),
        ...(rule.workerGroup && { workerGroup: rule.workerGroup }),
        ...(rule.maxSlotsPerPhase && { maxSlotsPerPhase: rule.maxSlotsPerPhase }),
        ...(rule.taskId && { taskId: rule.taskId }),
        ...(rule.allowedPhases && { allowedPhases: rule.allowedPhases }),
        ...(rule.phaseRange && { phaseRange: rule.phaseRange }),
        ...(rule.pattern && { pattern: rule.pattern }),
        ...(rule.ruleTemplate && { ruleTemplate: rule.ruleTemplate }),
        ...(rule.parameters && { parameters: rule.parameters }),
        ...(rule.scope && { scope: rule.scope }),
        ...(rule.overrides && { overrides: rule.overrides })
      }))
    };

    const blob = new Blob([JSON.stringify(rulesConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'business-rules-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderFormFields = () => {
    switch (formData.type) {
      case 'coRun':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Tasks ({formData.tasks.length} selected)
            </label>
            {errors.tasks && <div className="text-red-600 text-xs mb-2">{errors.tasks}</div>}
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
              {availableTasks.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-4">
                  No tasks available. Please upload and validate task data first.
                </div>
              ) : (
                <div className="space-y-2">
                  {availableTasks.map(taskId => (
                    <label key={taskId} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.tasks.includes(taskId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, tasks: [...prev.tasks, taskId] }));
                          } else {
                            setFormData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t !== taskId) }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-mono">{taskId}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'slotRestriction':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Group Type</label>
              <select
                value={formData.groupType}
                onChange={(e) => setFormData(prev => ({ ...prev, groupType: e.target.value as 'client' | 'worker' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="client">Client Group</option>
                <option value="worker">Worker Group</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Group</label>
              {errors.targetGroup && <div className="text-red-600 text-xs mb-2">{errors.targetGroup}</div>}
              <select
                value={formData.targetGroup}
                onChange={(e) => setFormData(prev => ({ ...prev, targetGroup: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a group...</option>
                {(formData.groupType === 'client' ? availableClientGroups : availableWorkerGroups).map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Common Slots</label>
              {errors.minCommonSlots && <div className="text-red-600 text-xs mb-2">{errors.minCommonSlots}</div>}
              <input
                type="number"
                min="1"
                value={formData.minCommonSlots}
                onChange={(e) => setFormData(prev => ({ ...prev, minCommonSlots: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'loadLimit':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Worker Group</label>
              {errors.workerGroup && <div className="text-red-600 text-xs mb-2">{errors.workerGroup}</div>}
              <select
                value={formData.workerGroup}
                onChange={(e) => setFormData(prev => ({ ...prev, workerGroup: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a worker group...</option>
                {availableWorkerGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Slots Per Phase</label>
              {errors.maxSlotsPerPhase && <div className="text-red-600 text-xs mb-2">{errors.maxSlotsPerPhase}</div>}
              <input
                type="number"
                min="1"
                value={formData.maxSlotsPerPhase}
                onChange={(e) => setFormData(prev => ({ ...prev, maxSlotsPerPhase: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'phaseWindow':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Task</label>
              {errors.taskId && <div className="text-red-600 text-xs mb-2">{errors.taskId}</div>}
              <select
                value={formData.taskId}
                onChange={(e) => setFormData(prev => ({ ...prev, taskId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a task...</option>
                {availableTasks.map(taskId => (
                  <option key={taskId} value={taskId}>{taskId}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  checked={formData.usePhaseRange}
                  onChange={(e) => setFormData(prev => ({ ...prev, usePhaseRange: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Use phase range instead of specific phases</span>
              </label>
            </div>
            {formData.usePhaseRange ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Phase</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.phaseRange.start}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      phaseRange: { ...prev.phaseRange, start: parseInt(e.target.value) || 1 }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Phase</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.phaseRange.end}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      phaseRange: { ...prev.phaseRange, end: parseInt(e.target.value) || 5 }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {errors.phaseRange && <div className="col-span-2 text-red-600 text-xs">{errors.phaseRange}</div>}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Phases</label>
                {errors.allowedPhases && <div className="text-red-600 text-xs mb-2">{errors.allowedPhases}</div>}
                <div className="space-y-2">
                  {phaseOptions.map(phase => (
                    <label key={phase} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allowedPhases.includes(phase)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, allowedPhases: [...prev.allowedPhases, phase] }));
                          } else {
                            setFormData(prev => ({ ...prev, allowedPhases: prev.allowedPhases.filter(p => p !== phase) }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{phase}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'patternMatch':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Regex Pattern</label>
              {errors.pattern && <div className="text-red-600 text-xs mb-2">{errors.pattern}</div>}
              <input
                type="text"
                value={formData.pattern}
                onChange={(e) => setFormData(prev => ({ ...prev, pattern: e.target.value }))}
                placeholder="e.g., ^TASK_[A-Z]{3}_\d+$"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rule Template</label>
              <select
                value={formData.ruleTemplate}
                onChange={(e) => setFormData(prev => ({ ...prev, ruleTemplate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ruleTemplates.map(template => (
                  <option key={template} value={template}>{template}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parameters (key=value, one per line)</label>
              <textarea
                value={Object.entries(formData.parameters).map(([k, v]) => `${k}=${v}`).join('\n')}
                onChange={(e) => {
                  const params: Record<string, string> = {};
                  e.target.value.split('\n').forEach(line => {
                    const [key, ...valueParts] = line.split('=');
                    if (key && valueParts.length > 0) {
                      params[key.trim()] = valueParts.join('=').trim();
                    }
                  });
                  setFormData(prev => ({ ...prev, parameters: params }));
                }}
                placeholder="timeout=30&#10;retries=3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                rows={4}
              />
            </div>
          </div>
        );

      case 'precedenceOverride':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value as 'global' | 'specific' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="global">Global Override</option>
                <option value="specific">Specific Rule Override</option>
              </select>
            </div>
            {formData.scope === 'specific' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rules to Override</label>
                {errors.overrides && <div className="text-red-600 text-xs mb-2">{errors.overrides}</div>}
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {rules.filter(r => r.id !== editingRule).map(rule => (
                    <label key={rule.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.overrides.includes(rule.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, overrides: [...prev.overrides, rule.id] }));
                          } else {
                            setFormData(prev => ({ ...prev, overrides: prev.overrides.filter(id => id !== rule.id) }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="text-sm">
                        <span className="font-medium">{ruleTypeLabels[rule.type]}</span>
                        <span className="text-gray-500 ml-2">{rule.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const groupedRules = rules.reduce((acc, rule) => {
    if (!acc[rule.type]) acc[rule.type] = [];
    acc[rule.type].push(rule);
    return acc;
  }, {} as Record<BusinessRule['type'], BusinessRule[]>);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Business Rules Configuration</h3>
            <p className="text-sm text-gray-600 mt-1">
              Define advanced business rules for task scheduling and resource allocation
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500">
              {rules.length} rule{rules.length !== 1 ? 's' : ''} defined
            </div>
            {rules.length > 0 && (
              <button
                onClick={handleGenerateRulesConfig}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
                <span>Generate Rules Config</span>
              </button>
            )}
            {!isAddingRule && (
              <button
                onClick={() => setIsAddingRule(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span>Add Rule</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Add/Edit Rule Form */}
        {isAddingRule && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              {editingRule ? 'Edit Rule' : 'Add New Business Rule'}
            </h4>
            
            <div className="space-y-4">
              {/* Rule Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rule Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(ruleTypeLabels).map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => setFormData(prev => ({ ...prev, type: type as BusinessRule['type'] }))}
                      className={`p-3 text-left border rounded-lg transition-colors ${
                        formData.type === type
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{ruleTypeIcons[type as BusinessRule['type']]}</span>
                        <div>
                          <div className="font-medium text-sm">{label}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {ruleTypeDescriptions[type as BusinessRule['type']]}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Form Fields */}
              {renderFormFields()}

              {/* Common Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-gray-700">
                    Rule is active
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                {errors.description && <div className="text-red-600 text-xs mb-2">{errors.description}</div>}
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the purpose and conditions of this rule..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                >
                  <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={editingRule ? handleUpdateRule : handleAddRule}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <FontAwesomeIcon icon={faSave} className="w-4 h-4" />
                  <span>{editingRule ? 'Update Rule' : 'Add Rule'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No business rules defined</h3>
            <p className="text-gray-500 mb-4">Create advanced rules to control task scheduling and resource allocation.</p>
            {!isAddingRule && (
              <button
                onClick={() => setIsAddingRule(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Your First Rule
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(ruleTypeLabels).map(([type, label]) => {
              const rulesOfType = groupedRules[type as BusinessRule['type']] || [];
              if (rulesOfType.length === 0) return null;

              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{ruleTypeIcons[type as BusinessRule['type']]}</span>
                    <h4 className="text-md font-medium text-gray-900">{label}</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {rulesOfType.length}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {rulesOfType.sort((a, b) => (b.priority || 1) - (a.priority || 1)).map(rule => (
                      <div
                        key={rule.id}
                        className={`p-4 border rounded-lg transition-colors ${
                          rule.active 
                            ? 'border-gray-200 bg-white' 
                            : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                                Priority {rule.priority || 1}
                              </div>
                              {!rule.active && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {rule.description && (
                              <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                            )}
                            <div className="text-xs text-gray-500">
                              {/* Show rule-specific details */}
                              {rule.tasks && `Tasks: ${rule.tasks.join(', ')}`}
                              {rule.targetGroup && `Group: ${rule.targetGroup} (${rule.groupType})`}
                              {rule.minCommonSlots && `, Min slots: ${rule.minCommonSlots}`}
                              {rule.workerGroup && `Worker group: ${rule.workerGroup}`}
                              {rule.maxSlotsPerPhase && `, Max slots/phase: ${rule.maxSlotsPerPhase}`}
                              {rule.taskId && `Task: ${rule.taskId}`}
                              {rule.allowedPhases && `, Phases: ${rule.allowedPhases.join(', ')}`}
                              {rule.phaseRange && `, Phase range: ${rule.phaseRange.start}-${rule.phaseRange.end}`}
                              {rule.pattern && `Pattern: ${rule.pattern}`}
                              {rule.scope && `Scope: ${rule.scope}`}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleToggleActive(rule.id)}
                              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                rule.active
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {rule.active ? 'Active' : 'Inactive'}
                            </button>
                            <button
                              onClick={() => handleEditRule(rule.id)}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}