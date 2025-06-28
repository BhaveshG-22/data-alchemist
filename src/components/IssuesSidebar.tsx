'use client';

import { ParsedData } from '@/utils/fileParser';

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: 'header' | 'data' | 'format' | 'missing';
  message: string;
  sheet: 'clients' | 'workers' | 'tasks';
  row?: number;
  column?: string;
  severity: 'high' | 'medium' | 'low';
}

interface IssuesSidebarProps {
  issues: ValidationIssue[];
  parsedData: {
    clients: ParsedData | null;
    workers: ParsedData | null;
    tasks: ParsedData | null;
  };
  activeTab: 'clients' | 'workers' | 'tasks';
  onIssueClick?: (issue: ValidationIssue) => void;
}

export default function IssuesSidebar({ issues, parsedData, activeTab, onIssueClick }: IssuesSidebarProps) {
  const filteredIssues = issues.filter(issue => issue.sheet === activeTab);
  const errorCount = filteredIssues.filter(issue => issue.type === 'error').length;
  const warningCount = filteredIssues.filter(issue => issue.type === 'warning').length;
  
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
      case 'header':
        return '📋';
      case 'data':
        return '📊';
      case 'format':
        return '🔧';
      case 'missing':
        return '❌';
    }
  };

  const currentData = parsedData[activeTab];

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
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

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto">
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
          <div className="p-2">
            {filteredIssues.map((issue, index) => (
              <div
                key={index}
                onClick={() => onIssueClick?.(issue)}
                className="p-3 mb-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIssueIcon(issue.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs">{getCategoryIcon(issue.category)}</span>
                      <span className="text-xs font-medium text-gray-600 capitalize">
                        {issue.category}
                      </span>
                      {issue.severity === 'high' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          High
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 mb-1">{issue.message}</p>
                    {(issue.row !== undefined || issue.column) && (
                      <div className="text-xs text-gray-500">
                        {issue.row !== undefined && `Row ${issue.row + 1}`}
                        {issue.row !== undefined && issue.column && ' • '}
                        {issue.column && `Column: ${issue.column}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {filteredIssues.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button className="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors">
            Auto-fix Issues
          </button>
        </div>
      )}
    </div>
  );
}