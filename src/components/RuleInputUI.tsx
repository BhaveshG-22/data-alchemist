'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faEdit, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
import { BusinessRule } from '@/validators/types';

interface RuleInputUIProps {
  rules: BusinessRule[];
  onRulesChange: (rules: BusinessRule[]) => void;
  availableTasks: string[];
}

interface RuleFormData {
  type: BusinessRule['type'];
  tasks: string[];
  description: string;
  active: boolean;
}

export default function RuleInputUI({ rules, onRulesChange, availableTasks }: RuleInputUIProps) {
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [formData, setFormData] = useState<RuleFormData>({
    type: 'coRun',
    tasks: [],
    description: '',
    active: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ruleTypeLabels = {
    coRun: 'Co-Run (Must Run Together)',
    conflicting: 'Conflicting (Cannot Run Together)', 
    priority: 'Priority Rules',
    resource: 'Resource Allocation'
  };

  const ruleTypeIcons = {
    coRun: '🔗',
    conflicting: '⚔️',
    priority: '⭐',
    resource: '📊'
  };

  const ruleTypeDescriptions = {
    coRun: 'Tasks that must be scheduled to run at the same time',
    conflicting: 'Tasks that cannot run simultaneously due to conflicts',
    priority: 'Tasks with specific priority requirements',
    resource: 'Tasks with specific resource allocation requirements'
  };

  const resetForm = () => {
    setFormData({
      type: 'coRun',
      tasks: [],
      description: '',
      active: true
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.tasks.length < 2) {
      newErrors.tasks = 'Please select at least 2 tasks';
    }

    if (formData.type === 'coRun' && formData.tasks.length < 2) {
      newErrors.tasks = 'Co-run rules require at least 2 tasks';
    }

    if (formData.type === 'conflicting' && formData.tasks.length < 2) {
      newErrors.tasks = 'Conflicting rules require at least 2 tasks';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Please provide a description';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddRule = () => {
    if (!validateForm()) return;

    const newRule: BusinessRule = {
      id: `rule_${Date.now()}`,
      type: formData.type,
      tasks: [...formData.tasks],
      description: formData.description,
      active: formData.active
    };

    onRulesChange([...rules, newRule]);
    resetForm();
    setIsAddingRule(false);
  };

  const handleEditRule = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      setFormData({
        type: rule.type,
        tasks: [...rule.tasks],
        description: rule.description || '',
        active: rule.active
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
            tasks: [...formData.tasks],
            description: formData.description,
            active: formData.active
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

  const handleTaskToggle = (taskId: string) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.includes(taskId)
        ? prev.tasks.filter(t => t !== taskId)
        : [...prev.tasks, taskId]
    }));
  };

  const handleCancel = () => {
    resetForm();
    setIsAddingRule(false);
    setEditingRule(null);
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
            <h3 className="text-lg font-semibold text-gray-900">Business Rules</h3>
            <p className="text-sm text-gray-600 mt-1">
              Define co-run, conflicting, priority, and resource allocation rules
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500">
              {rules.length} rule{rules.length !== 1 ? 's' : ''} defined
            </div>
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
              {editingRule ? 'Edit Rule' : 'Add New Rule'}
            </h4>
            
            <div className="space-y-4">
              {/* Rule Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rule Type
                </label>
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

              {/* Task Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Tasks ({formData.tasks.length} selected)
                </label>
                {errors.tasks && (
                  <div className="text-red-600 text-xs mb-2">{errors.tasks}</div>
                )}
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
                            onChange={() => handleTaskToggle(taskId)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-mono">{taskId}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                {errors.description && (
                  <div className="text-red-600 text-xs mb-2">{errors.description}</div>
                )}
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe why this rule is needed..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center space-x-2">
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
            <p className="text-gray-500 mb-4">Add rules to define task relationships and constraints.</p>
            {!isAddingRule && (
              <button
                onClick={() => setIsAddingRule(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Your First Rule
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
                    {rulesOfType.map(rule => (
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
                              <div className="flex flex-wrap gap-1">
                                {rule.tasks.map(taskId => (
                                  <span
                                    key={taskId}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded"
                                  >
                                    {taskId}
                                  </span>
                                ))}
                              </div>
                              {!rule.active && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {rule.description && (
                              <p className="text-sm text-gray-600">{rule.description}</p>
                            )}
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