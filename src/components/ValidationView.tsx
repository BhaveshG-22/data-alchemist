'use client';

import { useState, useEffect, useCallback } from 'react';
import TabbedDataView from './TabbedDataView';
import IssuesSidebar from './IssuesSidebar';
import ValidationSummary from './ValidationSummary';
import { parseFile, ParsedData } from '@/utils/fileParser';
import { 
  runAllValidations,
  ValidationIssue,
  ValidatorContext,
  ParsedData as ValidatedParsedData
} from '@/validators';

interface ValidationViewProps {
  uploadedFiles: {
    clients: File | null;
    workers: File | null;
    tasks: File | null;
  };
  onBack: () => void;
  onProceed: () => void;
}

export default function ValidationView({ uploadedFiles, onBack, onProceed }: ValidationViewProps) {
  const [parsedData, setParsedData] = useState<{
    clients: ParsedData | null;
    workers: ParsedData | null;
    tasks: ParsedData | null;
  }>({
    clients: null,
    workers: null,
    tasks: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{
    clients: string | null;
    workers: string | null;
    tasks: string | null;
  }>({
    clients: null,
    workers: null,
    tasks: null,
  });
  
  const [activeTab, setActiveTab] = useState<'clients' | 'workers' | 'tasks'>('clients');
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [highlightedCells, setHighlightedCells] = useState<Array<{ row: number; column: string }>>([]);
  const [highlightedHeaders] = useState<Array<{ sheet: string; header: string }>>([]);
  const [hoveredIssue, setHoveredIssue] = useState<{ row: number; column: string } | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  // New modular validation using the validators module
  const validateData = useCallback((parsedData: { clients: ParsedData | null; workers: ParsedData | null; tasks: ParsedData | null }): ValidationIssue[] => {
    console.log('🔍 Starting modular validation...');
    
    // Convert ParsedData to ValidatedParsedData format
    const validationData: ValidatedParsedData = {};
    
    if (parsedData.clients) {
      validationData.clients = {
        name: 'clients',
        headers: parsedData.clients.headers,
        rows: parsedData.clients.rows
      };
    }
    
    if (parsedData.workers) {
      validationData.workers = {
        name: 'workers', 
        headers: parsedData.workers.headers,
        rows: parsedData.workers.rows
      };
    }
    
    if (parsedData.tasks) {
      validationData.tasks = {
        name: 'tasks',
        headers: parsedData.tasks.headers, 
        rows: parsedData.tasks.rows
      };
    }

    // Create validation context
    const context: ValidatorContext = {
      data: validationData,
      config: {
        strictMode: false,
        autoFix: false,
        skipWarnings: false
      }
    };

    // Run validation
    const result = runAllValidations(context);
    console.log(`✅ Validation complete: ${result.issues.length} issues found`);
    
    return result.issues;
  }, []);


  const parseFiles = useCallback(async () => {
      setLoading(true);
      const newParsedData: {
        clients: ParsedData | null;
        workers: ParsedData | null;
        tasks: ParsedData | null;
      } = { clients: null, workers: null, tasks: null };
      
      const newErrors: {
        clients: string | null;
        workers: string | null;
        tasks: string | null;
      } = { clients: null, workers: null, tasks: null };

      // Parse clients file
      if (uploadedFiles.clients) {
        try {
          newParsedData.clients = await parseFile(uploadedFiles.clients);
        } catch (error) {
          newErrors.clients = (error as Error).message;
        }
      }

      // Parse workers file
      if (uploadedFiles.workers) {
        try {
          newParsedData.workers = await parseFile(uploadedFiles.workers);
        } catch (error) {
          newErrors.workers = (error as Error).message;
        }
      }

      // Parse tasks file
      if (uploadedFiles.tasks) {
        try {
          newParsedData.tasks = await parseFile(uploadedFiles.tasks);
        } catch (error) {
          newErrors.tasks = (error as Error).message;
        }
      }

      // Validate data using the new modular system
      const allIssues = validateData(newParsedData);

      setParsedData(newParsedData);
      setErrors(newErrors);
      setValidationIssues(allIssues);
      setLoading(false);
    }, [uploadedFiles, validateData]);

  useEffect(() => {
    parseFiles();
  }, [uploadedFiles, parseFiles]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const handleDataChange = (type: 'clients' | 'workers' | 'tasks') => async (newData: ParsedData) => {
    const updatedParsedData = {
      ...parsedData,
      [type]: newData
    };
    
    setParsedData(updatedParsedData);

    // Re-validate all data when it changes using the new system
    const newIssues = validateData(updatedParsedData);
    setValidationIssues(newIssues);
  };

  const handleIssueClick = (issue: ValidationIssue) => {
    console.log('Issue clicked:', issue);
    
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    // Handle header row highlighting (row = -1) for missing columns
    if (issue.row === -1 && issue.column) {
      // Highlight the header for missing/unexpected columns
      setHighlightedHeaders([{ header: issue.column }]);
      
      // Set timeout to auto-remove highlight after 4 seconds
      const timeoutId = setTimeout(() => {
        setHighlightedHeaders([]);
        setHoverTimeout(null);
      }, 4000);
      
      setHoverTimeout(timeoutId);
    }
    // Handle regular cell highlighting
    else if (issue.row !== undefined && issue.column) {
      setHoveredIssue({ row: issue.row, column: issue.column });
      
      // Set timeout to auto-remove hover after 4 seconds
      const timeoutId = setTimeout(() => {
        setHoveredIssue(null);
        setHoverTimeout(null);
      }, 4000);
      
      setHoverTimeout(timeoutId);
    }
    
    // Switch to the relevant tab if needed
    if (issue.sheet && issue.sheet !== activeTab) {
      setActiveTab(issue.sheet as 'clients' | 'workers' | 'tasks');
    }
  };

  const handleIssueHover = (issue: ValidationIssue) => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    // Only highlight if the issue has a specific row and column
    if (issue.row !== undefined && issue.column) {
      setHoveredIssue({ row: issue.row, column: issue.column });
      
      // Set timeout to auto-remove hover after 4 seconds
      const timeoutId = setTimeout(() => {
        setHoveredIssue(null);
        setHoverTimeout(null);
      }, 4000);
      
      setHoverTimeout(timeoutId);
    }
  };

  const handleIssueUnhover = () => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    
    setHoveredIssue(null);
  };

  const handleApplyAIFix = async (issue: ValidationIssue, aiSuggestion?: string) => {
    console.log('AI fix not implemented for missing columns - this is a detection-only validation');
    console.log('Issue:', issue);
    console.log('AI suggestion:', aiSuggestion);
    
    // For missing columns, we only detect and report - no auto-fixing
    // Users should manually add the missing columns to their spreadsheet
  };

  // Clean up helper function that's still needed
  const handleHighlightComplete = () => {
    setHighlightedCells([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Parsing uploaded files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Upload
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Data Validation</h1>
              <p className="text-sm text-gray-600">Review and validate your uploaded data files</p>
            </div>
          </div>
          <button 
            onClick={onProceed}
            disabled={validationIssues.some(issue => issue.type === 'error')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              validationIssues.some(issue => issue.type === 'error')
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Proceed to Analysis
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Data View */}
        <div className="flex-1 p-6">
          {/* Validation Summary */}
          {/* <ValidationSummary 
            issues={validationIssues} 
            onIssueClick={handleIssueClick}
          /> */}
          
          <TabbedDataView
            parsedData={parsedData}
            errors={errors}
            onDataChange={handleDataChange}
            onTabChange={setActiveTab}
            highlightedCells={highlightedCells}
            highlightedHeaders={highlightedHeaders}
            hoveredCell={hoveredIssue}
            onHighlightComplete={handleHighlightComplete}
          />
        </div>

        {/* Issues Sidebar */}
        <IssuesSidebar
          issues={validationIssues}
          parsedData={parsedData}
          activeTab={activeTab}
          onIssueClick={handleIssueClick}
          onApplyFix={handleApplyAIFix}
          onIssueHover={handleIssueHover}
          onIssueUnhover={handleIssueUnhover}
        />
      </div>
    </div>
  );
}