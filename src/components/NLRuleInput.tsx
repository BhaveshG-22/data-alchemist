'use client';

import { useState, useCallback } from 'react';
import { BusinessRule } from '@/validators/types';
import { validateNLGeneratedRule, NLRuleValidationResult } from '@/validators/validateNLRules';

interface NLRuleInputProps {
  onRuleGenerated: (rule: BusinessRule) => void;
  availableTasks: string[];
  availableClientGroups?: string[];
  availableWorkerGroups?: string[];
  disabled?: boolean;
}

export default function NLRuleInput({ 
  onRuleGenerated, 
  availableTasks,
  availableClientGroups = [],
  availableWorkerGroups = [],
  disabled = false 
}: NLRuleInputProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{ rule: BusinessRule; input: string; validation: NLRuleValidationResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const exampleInputs = [
    "Make T005 and T006 run together",
    "Limit GroupB to 2 tasks per phase",
    "Task T8 can only run in phase 1 and 3",
    "Tasks in Marketing group need at least 2 common slots",
    "Backend workers should have max 3 tasks per phase"
  ];

  const convertNaturalLanguageToRule = useCallback(async (naturalLanguageInput: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Create context for the AI to make better decisions
      const context = {
        availableTasks: availableTasks.slice(0, 10), // Sample tasks for context
        availableClientGroups: availableClientGroups.slice(0, 5),
        availableWorkerGroups: availableWorkerGroups.slice(0, 5)
      };

      const response = await fetch('/api/ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: naturalLanguageInput,
          category: 'natural_language_rule_conversion',
          context: context
        })
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const result = await response.json();
      let ruleJson = result.suggestion || '';

      // Clean up the AI response to extract JSON
      ruleJson = ruleJson
        .replace(/^```json\s*/, '')
        .replace(/```$/, '')
        .replace(/^\*\*Fix\*\*:\s*/, '')
        .replace(/^💡\s*\*\*Fix\*\*:\s*/, '')
        .replace(/\n.*$/m, '') // Remove everything after first newline
        .trim();

      // Extract JSON from response if it contains explanation
      const jsonMatch = ruleJson.match(/\{.*\}/s);
      if (jsonMatch) {
        ruleJson = jsonMatch[0];
      }

      let parsedRule;
      try {
        parsedRule = JSON.parse(ruleJson);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', ruleJson);
        throw new Error('Could not understand the rule. Please try rephrasing.');
      }

      // Validate the parsed rule using our validation schema
      const validation = validateNLGeneratedRule(
        parsedRule,
        availableTasks,
        availableClientGroups,
        availableWorkerGroups
      );

      if (!validation.isValid) {
        throw new Error(validation.errors.join('. '));
      }

      if (!validation.normalizedRule) {
        throw new Error('Failed to normalize the generated rule');
      }

      // Use the normalized rule which has proper mapping for the existing system
      const businessRule = {
        ...validation.normalizedRule,
        description: naturalLanguageInput
      };

      setLastResult({ 
        rule: businessRule, 
        input: naturalLanguageInput, 
        validation 
      });
      setShowPreview(true);

    } catch (error) {
      console.error('Natural language rule conversion error:', error);
      setError((error as Error).message || 'Failed to convert rule. Please try rephrasing.');
    } finally {
      setIsProcessing(false);
    }
  }, [availableTasks, availableClientGroups, availableWorkerGroups]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing && !disabled) {
      convertNaturalLanguageToRule(input.trim());
    }
  }, [input, isProcessing, disabled, convertNaturalLanguageToRule]);

  const handleAcceptRule = useCallback(() => {
    if (lastResult) {
      onRuleGenerated(lastResult.rule);
      setInput('');
      setLastResult(null);
      setShowPreview(false);
      setError(null);
    }
  }, [lastResult, onRuleGenerated]);

  const handleRejectRule = useCallback(() => {
    setLastResult(null);
    setShowPreview(false);
  }, []);

  const handleClear = useCallback(() => {
    setInput('');
    setLastResult(null);
    setShowPreview(false);
    setError(null);
  }, []);

  const formatRulePreview = (rule: BusinessRule): string => {
    switch (rule.type) {
      case 'coRun':
        return `Co-run: ${rule.tasks?.join(', ')}`;
      case 'slotRestriction':
        return `Slot restriction: ${rule.group} (min ${rule.minCommonSlots} slots)`;
      case 'loadLimit':
        return `Load limit: ${rule.group} (max ${rule.maxSlotsPerPhase} per phase)`;
      case 'phaseWindow':
        const phases = rule.phases ? rule.phases.join(', ') : 
                     rule.phaseRange ? `${rule.phaseRange.start}-${rule.phaseRange.end}` : 'unknown';
        return `Phase window: ${rule.task} in phases ${phases}`;
      case 'precedence':
        return `Precedence: ${rule.before} before ${rule.after}`;
      default:
        return `${rule.type} rule`;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Natural Language to Rules Converter</h3>
            <p className="text-sm text-gray-600 mt-0.5">Convert plain English instructions into structured business rules</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="w-4 h-4 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-red-800">{error}</div>
            </div>
          </div>
        )}

        {/* Rule Preview */}
        {showPreview && lastResult && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-900 mb-2">✅ Rule Generated Successfully</h4>
                <div className="text-sm text-blue-800 mb-3">
                  <strong>Input:</strong> "{lastResult.input}"<br/>
                  <strong>Generated:</strong> {formatRulePreview(lastResult.rule)}
                </div>
                
                {/* Show warnings if any */}
                {lastResult.validation.warnings.length > 0 && (
                  <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-sm text-yellow-800">
                      <strong>⚠️ Warnings:</strong>
                      <ul className="mt-1 list-disc list-inside">
                        {lastResult.validation.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <button
                    onClick={handleAcceptRule}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    Add Rule
                  </button>
                  <button
                    onClick={handleRejectRule}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Form */}
        {!showPreview && (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your rule in plain English, e.g., 'Make T005 and T006 run together' or 'Limit Marketing group to max 2 tasks per phase'"
                  disabled={disabled || isProcessing}
                  className="w-full px-4 py-3 pr-32 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 text-sm resize-none"
                  rows={3}
                />
                <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                  {input && (
                    <button
                      type="button"
                      onClick={handleClear}
                      disabled={disabled || isProcessing}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 hover:bg-gray-100 rounded transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim() || disabled || isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 text-sm font-medium transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Converting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Convert to Rule</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Example Queries */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Example instructions:</label>
              <div className="grid grid-cols-1 gap-2">
                {exampleInputs.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setInput(example)}
                    disabled={disabled || isProcessing}
                    className="px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left border border-gray-200"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Help Text */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-gray-700">
                  <strong>Supported rule types:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>• <strong>Co-run:</strong> "Make T1 and T2 run together"</li>
                    <li>• <strong>Load limits:</strong> "Limit GroupB to 2 tasks per phase"</li>
                    <li>• <strong>Phase windows:</strong> "Task T8 can only run in phase 1 and 3"</li>
                    <li>• <strong>Slot restrictions:</strong> "Marketing group needs 2 common slots"</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}