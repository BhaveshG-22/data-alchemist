'use client';

import React, { useState } from 'react';
import { ParsedData } from '@/utils/fileParser';
import { BusinessRule, ValidationIssue } from '@/validators';
import { exportAllData, exportAsZip, ExportRule } from '@/utils/exportUtils';
import { PrioritizationConfig } from '@/config/prioritizationCriteria';
import { toast } from 'react-toastify';

interface ExportButtonProps {
  parsedData: {
    clients: ParsedData | null;
    workers: ParsedData | null;
    tasks: ParsedData | null;
  };
  businessRules?: BusinessRule[];
  prioritizationConfig?: PrioritizationConfig;
  validationIssues?: ValidationIssue[];
  disabled?: boolean;
}

export default function ExportButton({ 
  parsedData, 
  businessRules = [], 
  prioritizationConfig,
  validationIssues = [],
  disabled = false 
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'individual' | 'zip'>('individual');
  const [showDropdown, setShowDropdown] = useState(false);

  const convertBusinessRulesToExportRules = (rules: BusinessRule[]): ExportRule[] => {
    return rules.map(rule => ({
      ...rule,
      type: rule.type
    }));
  };

  const getPriorities = (): Record<string, number> => {
    if (!prioritizationConfig || !prioritizationConfig.weights) return {};
    
    return prioritizationConfig.weights;
  };

  const validateDataForExport = (): { valid: boolean; message?: string } => {
    const { clients, workers, tasks } = parsedData;
    
    // Check for validation errors first
    const hasErrors = validationIssues.some(issue => issue.type === 'error');
    if (hasErrors) {
      const errorCount = validationIssues.filter(issue => issue.type === 'error').length;
      return { 
        valid: false, 
        message: `Cannot export data with ${errorCount} validation error${errorCount !== 1 ? 's' : ''}. Please fix all errors first.` 
      };
    }
    
    if (!clients && !workers && !tasks) {
      return { valid: false, message: 'No data available to export' };
    }

    let totalRows = 0;
    if (clients?.rows) totalRows += clients.rows.length;
    if (workers?.rows) totalRows += workers.rows.length;
    if (tasks?.rows) totalRows += tasks.rows.length;

    if (totalRows === 0) {
      return { valid: false, message: 'No data rows available to export' };
    }

    return { valid: true };
  };

  const handleExport = async () => {
    const validation = validateDataForExport();
    if (!validation.valid) {
      toast.error(validation.message || 'Cannot export data');
      return;
    }

    setIsExporting(true);
    
    try {
      const exportRules = convertBusinessRulesToExportRules(businessRules);
      const priorities = getPriorities();

      if (exportFormat === 'zip') {
        await exportAsZip(
          parsedData.clients,
          parsedData.workers,
          parsedData.tasks,
          exportRules,
          priorities
        );
        toast.success('Data exported as ZIP file successfully!');
      } else {
        exportAllData(
          parsedData.clients,
          parsedData.workers,
          parsedData.tasks,
          exportRules,
          priorities
        );
        toast.success('Data exported successfully!');
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getDataSummary = () => {
    const { clients, workers, tasks } = parsedData;
    const summary = [];
    
    if (clients?.rows?.length) {
      summary.push(`${clients.rows.length} clients`);
    }
    if (workers?.rows?.length) {
      summary.push(`${workers.rows.length} workers`);
    }
    if (tasks?.rows?.length) {
      summary.push(`${tasks.rows.length} tasks`);
    }
    
    return summary.length > 0 ? summary.join(', ') : 'No data';
  };

  const hasValidationErrors = validationIssues.some(issue => issue.type === 'error');
  const isDisabled = disabled || isExporting || hasValidationErrors || (!parsedData.clients && !parsedData.workers && !parsedData.tasks);
  
  const getDisabledReason = (): string => {
    if (isExporting) return 'Export in progress...';
    if (hasValidationErrors) {
      const errorCount = validationIssues.filter(issue => issue.type === 'error').length;
      return `Fix ${errorCount} validation error${errorCount !== 1 ? 's' : ''} before exporting`;
    }
    if (!parsedData.clients && !parsedData.workers && !parsedData.tasks) {
      return 'No data available to export';
    }
    if (disabled) return 'Export disabled';
    return '';
  };

  return (
    <div className="relative group">
      <div className="flex items-center space-x-0">
        <button
          onClick={handleExport}
          disabled={isDisabled}
          className={`flex items-center justify-center px-4 py-2 rounded-l-lg font-medium transition-colors ${
            isDisabled
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-300'
          }`}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Export {exportFormat === 'zip' ? 'ZIP' : 'Files'}
            </>
          )}
        </button>
        
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isDisabled}
          className={`flex items-center justify-center px-2 py-2 rounded-r-lg border-l ${isDisabled ? 'border-gray-500' : 'border-green-700'} font-medium transition-colors ${
            isDisabled
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showDropdown ? "M19 9l-7 7-7-7" : "M19 9l-7 7-7-7"} />
          </svg>
        </button>
      </div>
      
      {showDropdown && !isDisabled && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 space-y-3">
            <div className="text-sm font-medium text-gray-700 mb-3">Choose Export Format:</div>
            
            <div className="space-y-3">
              <label className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                exportFormat === 'individual' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="individual"
                  checked={exportFormat === 'individual'}
                  onChange={(e) => setExportFormat(e.target.value as 'individual' | 'zip')}
                  className="w-4 h-4 mt-0.5 text-green-600 bg-gray-100 border-gray-300 focus:ring-green-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-semibold text-gray-800">Individual Files</div>
                  <div className="text-xs text-gray-600 mt-1">Download 4 separate files:</div>
                  <div className="text-xs text-gray-500 mt-1">
                    • clients.csv<br/>
                    • workers.csv<br/>
                    • tasks.csv<br/>
                    • rules.json
                  </div>
                </div>
              </label>
              
              <label className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                exportFormat === 'zip' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="zip"
                  checked={exportFormat === 'zip'}
                  onChange={(e) => setExportFormat(e.target.value as 'individual' | 'zip')}
                  className="w-4 h-4 mt-0.5 text-green-600 bg-gray-100 border-gray-300 focus:ring-green-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-semibold text-gray-800">ZIP Archive</div>
                  <div className="text-xs text-gray-600 mt-1">Single bundled download:</div>
                  <div className="text-xs text-gray-500 mt-1">
                    📦 data-alchemist-export.zip<br/>
                    <span className="text-gray-400">Contains all files above</span>
                  </div>
                </div>
              </label>
            </div>
            
            <div className="pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-600">
                <div className="font-medium text-gray-700 mb-1">📊 Ready to export:</div>
                <div className="text-gray-600">{getDataSummary()}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
      
      {/* Tooltip for disabled state */}
      {isDisabled && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
          {getDisabledReason()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}