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
      <div className="flex items-center shadow-lg rounded-xl overflow-hidden bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:via-blue-700 hover:to-blue-800 transition-all duration-200">
        <button
          onClick={handleExport}
          disabled={isDisabled}
          className={`flex items-center justify-center px-6 py-3 font-semibold text-sm transition-all duration-200 relative ${
            isDisabled
              ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-gray-200 cursor-not-allowed opacity-70'
              : 'text-white hover:shadow-xl focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50'
          }`}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="tracking-wide">Exporting...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span className="tracking-wide font-medium">Export {exportFormat === 'zip' ? 'ZIP' : 'Files'}</span>
            </>
          )}
        </button>
        
        <div className={`w-px h-8 ${isDisabled ? 'bg-gray-400' : 'bg-blue-500'}`}></div>
        
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isDisabled}
          className={`flex items-center justify-center px-4 py-3 font-medium transition-all duration-200 relative ${
            isDisabled
              ? 'text-gray-200 cursor-not-allowed'
              : 'text-white hover:bg-white hover:bg-opacity-10 focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50'
          }`}
        >
          <svg 
            className={`w-5 h-5 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {showDropdown && !isDisabled && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 backdrop-blur-sm">
          <div className="p-6 space-y-4">
            <div className="text-base font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"/>
              </svg>
              Choose Export Format
            </div>
            
            <div className="space-y-4">
              <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                exportFormat === 'individual' 
                  ? 'border-blue-500 bg-blue-50 shadow-sm' 
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="individual"
                  checked={exportFormat === 'individual'}
                  onChange={(e) => setExportFormat(e.target.value as 'individual' | 'zip')}
                  className="w-5 h-5 mt-0.5 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                />
                <div className="ml-4">
                  <div className="text-sm font-bold text-gray-800 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                    Individual Files
                  </div>
                  <div className="text-xs text-gray-600 mt-2">Download 4 separate files:</div>
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                      clients.csv
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                      workers.csv
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                      tasks.csv
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                      rules.json
                    </div>
                  </div>
                </div>
              </label>
              
              <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                exportFormat === 'zip' 
                  ? 'border-blue-500 bg-blue-50 shadow-sm' 
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="zip"
                  checked={exportFormat === 'zip'}
                  onChange={(e) => setExportFormat(e.target.value as 'individual' | 'zip')}
                  className="w-5 h-5 mt-0.5 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                />
                <div className="ml-4">
                  <div className="text-sm font-bold text-gray-800 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                    ZIP Archive
                  </div>
                  <div className="text-xs text-gray-600 mt-2">Single bundled download:</div>
                  <div className="text-xs text-gray-500 mt-2">
                    <div className="flex items-center p-2 bg-gray-100 rounded-lg">
                      <span className="text-lg mr-2">📦</span>
                      <div>
                        <div className="font-medium text-gray-700">data-alchemist-export.zip</div>
                        <div className="text-gray-500">Contains all files above</div>
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  <div className="font-semibold text-blue-800">Ready to Export</div>
                </div>
                <div className="text-sm text-blue-700 font-medium">{getDataSummary()}</div>
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
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-[60] shadow-xl">
          {getDisabledReason()}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
        </div>
      )}
    </div>
  );
}