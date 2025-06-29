'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { ParsedData } from '@/utils/fileParser';
import { ValidationIssue } from '@/validators';

interface IssuesSidebarProps {
  issues: ValidationIssue[];
  parsedData: {
    clients: ParsedData | null;
    workers: ParsedData | null;
    tasks: ParsedData | null;
  };
  activeTab: 'clients' | 'workers' | 'tasks';
  onIssueClick?: (issue: ValidationIssue) => void;
  onApplyFix?: (issue: ValidationIssue, aiSuggestion?: string) => void;
  onIssueHover?: (issue: ValidationIssue) => void;
  onIssueUnhover?: () => void;
}

export default function IssuesSidebar({ issues, parsedData, activeTab, onIssueClick, onApplyFix, onIssueHover, onIssueUnhover }: IssuesSidebarProps) {
  const filteredIssues = issues.filter(issue => issue.sheet === activeTab);
  const errorCount = filteredIssues.filter(issue => issue.type === 'error').length;
  const warningCount = filteredIssues.filter(issue => issue.type === 'warning').length;
  
  const [loadingAI, setLoadingAI] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Group issues by category
  const groupedIssues = filteredIssues.reduce((acc, issue) => {
    const category = issue.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(issue);
    return acc;
  }, {} as Record<string, ValidationIssue[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAIFix = async (issue: ValidationIssue, index: number) => {
    setLoadingAI(index);
    
    try {
      // Get current headers for context
      const sheetName = issue.sheet as 'clients' | 'workers' | 'tasks' | undefined;
      const currentData = sheetName ? parsedData[sheetName] : null;
      const currentHeaders = currentData?.headers || [];
      
      // For missing columns, gather comprehensive context
      let additionalContext = {};
      if (issue.category === 'missing_columns' && currentData) {
        // Get required columns for this sheet
        const requiredColumns = {
          clients: ['ClientID', 'ClientName', 'PriorityLevel', 'RequestedTaskIDs', 'GroupTag', 'AttributesJSON'],
          workers: ['WorkerID', 'WorkerName', 'Skills', 'AvailableSlots', 'MaxLoadPerPhase', 'WorkerGroup', 'QualificationLevel'],
          tasks: ['TaskID', 'TaskName', 'Category', 'Duration', 'RequiredSkills', 'PreferredPhases', 'MaxConcurrent'],
        };
        
        const required = requiredColumns[sheetName as keyof typeof requiredColumns] || [];
        const missing = required.filter(col => !currentHeaders.includes(col));
        const unexpected = currentHeaders.filter(col => !required.includes(col));
        
        // Create sample data for better AI context
        const sampleData: Record<string, unknown[]> = {};
        currentHeaders.forEach(header => {
          sampleData[header] = currentData.rows.slice(0, 3).map(row => row[header]);
        });
        
        additionalContext = {
          currentHeaders,
          requiredHeaders: required,
          missingColumns: missing,
          unexpectedColumns: unexpected,
          sampleData
        };
      }

      const response = await fetch('/api/ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue, ...additionalContext })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      setAiSuggestions(prev => ({ 
        ...prev, 
        [index]: data.suggestion 
      }));

    } catch (error) {
      console.error('AI Fix Error:', error);
      
      // Fallback to local suggestion
      const fallbackSuggestion = getLocalFallbackSuggestion(issue);
      setAiSuggestions(prev => ({ 
        ...prev, 
        [index]: `⚠️ AI service unavailable. Here's a basic suggestion:\n\n${fallbackSuggestion}` 
      }));
    } finally {
      setLoadingAI(null);
    }
  };

  // Local fallback when API fails
  const getLocalFallbackSuggestion = (issue: ValidationIssue): string => {
    switch (issue.category) {
      case 'missing_columns':
        if (issue.message.includes('Missing required column')) {
          return `Add the missing column "${issue.column}" to your ${issue.sheet} sheet.`;
        } else if (issue.message.includes('Unexpected column')) {
          return `Remove or rename the unexpected column "${issue.column}".`;
        }
        break;
      case 'duplicate_ids':
        return `Change the duplicate ID "${issue.value}" to a unique identifier.`;
      case 'malformed_lists':
        return `Fix the list format in ${issue.column}. Use comma-separated values.`;
      case 'out_of_range':
        return `Update ${issue.column} to use a valid range value.`;
      case 'json_fields':
        return `Fix the JSON format in ${issue.column}. Ensure proper JSON syntax with quotes around keys.`;
      case 'references':
        return `Ensure the referenced ID exists in the target sheet.`;
      case 'overloaded_workers':
        return `Reduce the workload or increase available capacity for this worker.`;
      case 'skill_coverage':
        return `Add workers with the required skills or remove tasks requiring unavailable skills.`;
      case 'concurrency_feasibility':
        return `Review the concurrency settings for this task.`;
    }
    return 'Review the data format requirements and update accordingly.';
  };
  
  const getIssueIcon = (type: ValidationIssue['type']) => {
    switch (type) {
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getCategoryIcon = (category: ValidationIssue['category']) => {
    switch (category) {
      case 'missing_columns':
        return '📋';
      case 'duplicate_ids':
        return '🔄';
      case 'malformed_lists':
        return '📝';
      case 'out_of_range':
        return '📊';
      case 'json_fields':
        return '🔧';
      case 'references':
        return '🔗';
      case 'circular_corun':
        return '♻️';
      case 'conflicting_rules':
        return '⚠️';
      case 'overloaded_workers':
        return '👥';
      case 'phase_saturation':
        return '📈';
      case 'skill_coverage':
        return '🎯';
      case 'concurrency_feasibility':
        return '⚡';
      default:
        return '❓';
    }
  };

  const getCategoryDisplayName = (category: ValidationIssue['category']) => {
    switch (category) {
      case 'missing_columns':
        return 'Missing Columns';
      case 'duplicate_ids':
        return 'Duplicate IDs';
      case 'malformed_lists':
        return 'Malformed Lists';
      case 'out_of_range':
        return 'Out of Range';
      case 'json_fields':
        return 'JSON Fields';
      case 'references':
        return 'References';
      case 'circular_corun':
        return 'Circular Dependencies';
      case 'conflicting_rules':
        return 'Conflicting Rules';
      case 'overloaded_workers':
        return 'Overloaded Workers';
      case 'phase_saturation':
        return 'Phase Saturation';
      case 'skill_coverage':
        return 'Skill Coverage';
      case 'concurrency_feasibility':
        return 'Concurrency Issues';
      default:
        return String(category).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
  };

  const formatAISuggestion = (suggestion: string) => {
    // Split the suggestion into lines and process each one
    const lines = suggestion.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      
      // Handle emoji + bold headers (💡 **Fix**: content)
      const emojiHeaderMatch = trimmedLine.match(/^([💡🔗📋📊📝✅⚠️🎯⚖️👥♻️📈🔧]+)\s*\*\*([^*]+)\*\*:\s*(.*)$/);
      if (emojiHeaderMatch) {
        const [, emoji, title, content] = emojiHeaderMatch;
        return (
          <div key={index} className="mb-2">
            <div className="flex items-start space-x-2">
              <span className="text-sm">{emoji}</span>
              <div className="flex-1">
                <span className="font-semibold text-gray-800 text-sm">{title}:</span>
                <span className="text-gray-700 text-sm ml-1">{content}</span>
              </div>
            </div>
          </div>
        );
      }
      
      // Handle bold headers without emoji (**Title**: content)
      const boldHeaderMatch = trimmedLine.match(/^\*\*([^*]+)\*\*:\s*(.*)$/);
      if (boldHeaderMatch) {
        const [, title, content] = boldHeaderMatch;
        return (
          <div key={index} className="mb-2">
            <span className="font-semibold text-gray-800 text-sm">{title}:</span>
            <span className="text-gray-700 text-sm ml-1">{content}</span>
          </div>
        );
      }
      
      // Handle lines that start with emoji but no bold
      const emojiLineMatch = trimmedLine.match(/^([💡🔗📋📊📝✅⚠️🎯⚖️👥♻️📈🔧]+)\s*(.*)$/);
      if (emojiLineMatch) {
        const [, emoji, content] = emojiLineMatch;
        return (
          <div key={index} className="mb-1 flex items-start space-x-2">
            <span className="text-sm">{emoji}</span>
            <span className="text-gray-700 text-sm">{content}</span>
          </div>
        );
      }
      
      // Regular text lines
      if (trimmedLine) {
        return (
          <div key={index} className="text-gray-700 text-sm mb-1">
            {trimmedLine}
          </div>
        );
      }
      
      return null;
    }).filter(Boolean);
  };

  const currentData = parsedData[activeTab];

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col sticky top-0 h-[calc(100vh-88px)] shadow-lg z-10">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Validation Issues</h3>
        <div className="text-sm text-gray-600 capitalize mb-3">
          {activeTab} Sheet
        </div>
        
        {/* Summary Stats */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{errorCount} Errors</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span>{warningCount} Warnings</span>
          </div>
        </div>
        
        {currentData && (
          <div className="mt-3 text-xs text-gray-500">
            {currentData.rows.length} rows • {currentData.headers.length} columns
          </div>
        )}
      </div>

      {/* Issues List - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredIssues.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-green-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 font-medium">No issues found!</p>
            <p className="text-xs text-gray-500 mt-1">Your {activeTab} data looks good.</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {Object.entries(groupedIssues).map(([category, categoryIssues]) => {
              const isExpanded = expandedCategories.has(category);
              const categoryErrorCount = categoryIssues.filter(issue => issue.type === 'error').length;
              const categoryWarningCount = categoryIssues.filter(issue => issue.type === 'warning').length;
              const categoryInfoCount = categoryIssues.filter(issue => issue.type === 'info').length;
              
              return (
                <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Accordion Header */}
                  <div 
                    onClick={() => toggleCategory(category)}
                    className="bg-gray-50 border-b border-gray-200 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getCategoryIcon(category as ValidationIssue['category'])}</span>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {getCategoryDisplayName(category as ValidationIssue['category'])}
                          </h4>
                          <div className="flex items-center space-x-3 text-xs text-gray-600 mt-1">
                            {categoryErrorCount > 0 && (
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span>{categoryErrorCount} errors</span>
                              </div>
                            )}
                            {categoryWarningCount > 0 && (
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span>{categoryWarningCount} warnings</span>
                              </div>
                            )}
                            {categoryInfoCount > 0 && (
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>{categoryInfoCount} info</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                          {categoryIssues.length}
                        </span>
                        <svg 
                          className={`w-4 h-4 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="space-y-2 p-2">
                      {categoryIssues.map((issue, issueIndex) => {
                        const globalIndex = filteredIssues.findIndex(i => i === issue);
                        return (
                          <div
                            key={`${category}-${issueIndex}`}
                            className="border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors overflow-hidden"
                            onMouseEnter={() => onIssueHover?.(issue)}
                            onMouseLeave={() => onIssueUnhover?.()}
                          >
                            <div 
                              onClick={() => onIssueClick?.(issue)}
                              className="p-3 cursor-pointer"
                            >
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  {getIssueIcon(issue.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    {issue.type === 'error' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Error
                                      </span>
                                    )}
                                    {issue.type === 'warning' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        Warning
                                      </span>
                                    )}
                                    {issue.type === 'info' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Info
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-900 mb-1">{issue.message}</p>
                                  {(issue.row !== undefined || issue.column) && (
                                    <div className="text-xs text-gray-500">
                                      {issue.row !== undefined && (
                                        <>
                                          <span>Row {issue.row + 1}</span>
                                          <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                            Page {Math.ceil((issue.row + 1) / 50)}
                                          </span>
                                        </>
                                      )}
                                      {issue.row !== undefined && issue.column && ' • '}
                                      {issue.column && `Column: ${issue.column}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* AI Fix Button */}
                            <div className="px-3 pb-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAIFix(issue, globalIndex);
                                }}
                                disabled={loadingAI === globalIndex}
                                className="w-full bg-blue-600 text-white text-xs py-2 px-3 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loadingAI === globalIndex ? (
                                  <div className="flex items-center justify-center space-x-2">
                                    <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                                    <span>Loading...</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center space-x-2">
                                    <FontAwesomeIcon icon={faMicrochip} className="w-3 h-3" />
                                    <span>Ask AI</span>
                                  </div>
                                )}
                              </button>
                            </div>

                            {/* AI Suggestion */}
                            {aiSuggestions[globalIndex] && (
                              <div className="border-t border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50 p-3">
                                <div className="mb-3">
                                  {formatAISuggestion(aiSuggestions[globalIndex])}
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => {
                                      onApplyFix?.(issue, aiSuggestions[globalIndex]);
                                      setAiSuggestions(prev => {
                                        const newSuggestions = { ...prev };
                                        delete newSuggestions[globalIndex];
                                        return newSuggestions;
                                      });
                                    }}
                                    className="flex-1 bg-green-600 text-white text-xs py-2 px-3 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span>Apply Fix</span>
                                  </button>
                                  
                                  <button
                                    onClick={() => setAiSuggestions(prev => {
                                      const newSuggestions = { ...prev };
                                      delete newSuggestions[globalIndex];
                                      return newSuggestions;
                                    })}
                                    className="flex-1 bg-gray-600 text-white text-xs py-2 px-3 rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>Handle Manually</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Actions - Fixed */}
      {filteredIssues.length > 0 && (
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
          <button className="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors">
            Auto-fix Issues
          </button>
        </div>
      )}
    </div>
  );
}