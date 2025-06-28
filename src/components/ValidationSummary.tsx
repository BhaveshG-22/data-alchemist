import React from 'react';
import { ValidationIssue } from '@/validators';

interface ValidationSummaryProps {
  issues: ValidationIssue[];
  onIssueClick?: (issue: ValidationIssue) => void;
}

export default function ValidationSummary({ issues, onIssueClick }: ValidationSummaryProps) {
  const errors = issues.filter(issue => issue.type === 'error');
  const warnings = issues.filter(issue => issue.type === 'warning');
  const info = issues.filter(issue => issue.type === 'info');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'missing_columns': return '📋';
      case 'duplicate_ids': return '🔄';
      case 'malformed_lists': return '📝';
      case 'out_of_range': return '📊';
      case 'json_fields': return '🔧';
      case 'references': return '🔗';
      case 'circular_corun': return '🔄';
      case 'conflicting_rules': return '⚠️';
      case 'overloaded_workers': return '👥';
      case 'phase_saturation': return '📈';
      case 'skill_coverage': return '🎯';
      case 'concurrency_feasibility': return '⚡';
      default: return '❓';
    }
  };

  const getIssueLocation = (issue: ValidationIssue) => {
    const parts = [];
    if (issue.sheet) parts.push(`Sheet: ${issue.sheet}`);
    if (issue.row !== undefined) {
      if (issue.row === -1) {
        parts.push('Header row');
      } else {
        parts.push(`Row: ${issue.row + 1}`);
      }
    }
    if (issue.column) parts.push(`Column: ${issue.column}`);
    return parts.join(', ');
  };

  if (issues.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-2xl">✅</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Validation Passed
            </h3>
            <div className="text-sm text-green-700">
              No validation issues found. Your data meets all requirements.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Validation Summary</h3>
        <div className="mt-1 text-sm text-gray-600">
          Found {issues.length} issue{issues.length !== 1 ? 's' : ''} across your data
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex space-x-6">
          {errors.length > 0 && (
            <div className="flex items-center">
              <span className="text-red-500 text-lg mr-1">🔴</span>
              <span className="text-sm font-medium text-red-700">
                {errors.length} Error{errors.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="flex items-center">
              <span className="text-yellow-500 text-lg mr-1">🟡</span>
              <span className="text-sm font-medium text-yellow-700">
                {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {info.length > 0 && (
            <div className="flex items-center">
              <span className="text-blue-500 text-lg mr-1">🔵</span>
              <span className="text-sm font-medium text-blue-700">
                {info.length} Info
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Issue List */}
      <div className="max-h-64 overflow-y-auto">
        {issues.map((issue, index) => (
          <div
            key={issue.id}
            className={`px-4 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${
              issue.type === 'error' ? 'border-l-4 border-red-400' :
              issue.type === 'warning' ? 'border-l-4 border-yellow-400' :
              'border-l-4 border-blue-400'
            }`}
            onClick={() => onIssueClick?.(issue)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <span className="text-lg">{getCategoryIcon(issue.category)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      issue.type === 'error' ? 'bg-red-100 text-red-800' :
                      issue.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {issue.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {issue.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-900">{issue.message}</p>
                  {getIssueLocation(issue) && (
                    <p className="mt-1 text-xs text-gray-500">
                      {getIssueLocation(issue)}
                    </p>
                  )}
                  {issue.suggestion && (
                    <p className="mt-1 text-xs text-gray-600 italic">
                      Suggestion: {issue.suggestion}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}