'use client';

import { useState, useEffect, useCallback } from 'react';
import TabbedDataView from './TabbedDataView';
import IssuesSidebar from './IssuesSidebar';
// import ValidationSummary from './ValidationSummary';
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
  const [parsingProgress, setParsingProgress] = useState<{
    currentFile: string;
    step: string;
    filesProcessed: number;
    totalFiles: number;
  }>({ currentFile: '', step: 'Starting...', filesProcessed: 0, totalFiles: 0 });
  const [parsingComplete, setParsingComplete] = useState(false);
  const [parsingSummary, setParsingSummary] = useState<{
    aiMappingsApplied: Array<{
      file: string;
      mappings: Array<{ from: string; to: string }>;
      confidence: number;
    }>;
    totalFiles: number;
    totalMappings: number;
  } | null>(null);
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
  const [highlightedHeaders, setHighlightedHeaders] = useState<Array<{ sheet: string; header: string }>>([]);
  const [hoveredIssue, setHoveredIssue] = useState<{ row: number; column: string } | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showColumnMappingDialog, setShowColumnMappingDialog] = useState(false);
  const [columnMappingSuggestions, setColumnMappingSuggestions] = useState<{
    mappings: Array<{ originalHeader: string; suggestedHeader: string; confidence: number; reasoning: string }>;
    unmappedColumns: string[];
    missingColumns: string[];
    confidence: number;
  } | null>(null);
  const [currentMappingFile, setCurrentMappingFile] = useState<'clients' | 'workers' | 'tasks' | null>(null);

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

  // AI Column Mapping Function
  const getColumnMappingSuggestions = useCallback(async (
    fileType: 'clients' | 'workers' | 'tasks',
    headers: string[],
    sampleData: Record<string, unknown[]>
  ) => {
    try {
      console.log('🤖 Requesting AI column mapping for:', fileType);
      
      const response = await fetch('/api/ai-column-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType,
          headers,
          sampleData
        })
      });

      if (!response.ok) {
        throw new Error('AI mapping service unavailable');
      }

      const result = await response.json();
      console.log('✅ AI mapping suggestions received:', result);
      
      return result;
    } catch (error) {
      console.error('AI column mapping failed:', error);
      return null;
    }
  }, []);

  // Apply column mappings to parsed data
  const applyColumnMappings = useCallback((
    parsedData: ParsedData,
    mappings: Array<{ originalHeader: string; suggestedHeader: string }>
  ): ParsedData => {
    if (!mappings || mappings.length === 0) return parsedData;

    const mappingMap = new Map<string, string>();
    mappings.forEach(mapping => {
      mappingMap.set(mapping.originalHeader, mapping.suggestedHeader);
    });

    // Map headers
    const newHeaders = parsedData.headers.map(header => 
      mappingMap.get(header) || header
    );

    // Map row data
    const newRows = parsedData.rows.map(row => {
      const newRow: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        const newKey = mappingMap.get(key) || key;
        newRow[newKey] = value;
      });
      return newRow;
    });

    return {
      headers: newHeaders,
      rows: newRows
    };
  }, []);

  const parseFiles = useCallback(async () => {
      setLoading(true);
      setParsingComplete(false);
      setParsingSummary(null);
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

      // Parse and potentially apply AI column mapping for each file
      const fileTypes: Array<'clients' | 'workers' | 'tasks'> = ['clients', 'workers', 'tasks'];
      const uploadedFilesList = fileTypes.filter(type => uploadedFiles[type]);
      const aiMappingsApplied: Array<{
        file: string;
        mappings: Array<{ from: string; to: string }>;
        confidence: number;
      }> = [];

      setParsingProgress({
        currentFile: '',
        step: 'Initializing...',
        filesProcessed: 0,
        totalFiles: uploadedFilesList.length
      });
      
      for (let i = 0; i < fileTypes.length; i++) {
        const fileType = fileTypes[i];
        const file = uploadedFiles[fileType];
        if (!file) continue;

        try {
          setParsingProgress({
            currentFile: fileType,
            step: `Parsing ${fileType} file...`,
            filesProcessed: i,
            totalFiles: uploadedFilesList.length
          });

          // Initial parsing
          const initialParsedData = await parseFile(file);
          
          // Create sample data for AI analysis
          const sampleData: Record<string, unknown[]> = {};
          initialParsedData.headers.forEach(header => {
            sampleData[header] = initialParsedData.rows
              .slice(0, 5)
              .map(row => row[header])
              .filter(val => val !== null && val !== undefined && val !== '');
          });

          // Check if AI column mapping might be beneficial (more lenient detection)
          const requiredColumnsForFile = ['ClientID', 'ClientName', 'WorkerID', 'WorkerName', 'TaskID', 'TaskName', 'PriorityLevel', 'Duration', 'Skills', 'Category'];
          const hasWrongHeaders = initialParsedData.headers.some(header => 
            !requiredColumnsForFile.some(required => 
              header.toLowerCase().replace(/[_\s-]/g, '') === required.toLowerCase().replace(/[_\s-]/g, '') ||
              header.toLowerCase().includes(required.toLowerCase().replace(/[_\s-]/g, '').slice(0, -2)) // partial match
            )
          ) && initialParsedData.headers.length > 0;

          let finalParsedData = initialParsedData;

          if (hasWrongHeaders) {
            console.log(`🔍 Potentially misnamed headers detected in ${fileType}, trying AI mapping...`);
            
            setParsingProgress({
              currentFile: fileType,
              step: `Analyzing ${fileType} columns with AI...`,
              filesProcessed: i,
              totalFiles: uploadedFilesList.length
            });
            
            // Get AI mapping suggestions
            const mappingSuggestions = await getColumnMappingSuggestions(
              fileType,
              initialParsedData.headers,
              sampleData
            );

            // If we got good mapping suggestions with high confidence, apply them
            if (mappingSuggestions && 
                mappingSuggestions.mappings?.length > 0 && 
                mappingSuggestions.confidence > 0.7) {
              
              setParsingProgress({
                currentFile: fileType,
                step: `Applying AI column mappings to ${fileType}...`,
                filesProcessed: i,
                totalFiles: uploadedFilesList.length
              });
              
              console.log(`✨ Applying AI column mappings for ${fileType} (confidence: ${mappingSuggestions.confidence})`);
              finalParsedData = applyColumnMappings(initialParsedData, mappingSuggestions.mappings);
              
              // Store mapping info for summary
              aiMappingsApplied.push({
                file: fileType,
                mappings: mappingSuggestions.mappings.map((m: { originalHeader: string; suggestedHeader: string }) => ({
                  from: m.originalHeader,
                  to: m.suggestedHeader
                })),
                confidence: mappingSuggestions.confidence
              });
              
              console.log(`📝 Applied ${mappingSuggestions.mappings.length} column mappings:`, 
                mappingSuggestions.mappings.map((m: { originalHeader: string; suggestedHeader: string }) => `${m.originalHeader} → ${m.suggestedHeader}`));
              
            } else if (mappingSuggestions && mappingSuggestions.mappings?.length > 0) {
              // Store suggestions for user confirmation dialog
              setColumnMappingSuggestions(mappingSuggestions);
              setCurrentMappingFile(fileType);
              setShowColumnMappingDialog(true);
            }
          }

          newParsedData[fileType] = finalParsedData;
          
        } catch (error) {
          newErrors[fileType] = (error as Error).message;
        }
      }

      setParsingProgress({
        currentFile: '',
        step: 'Validating parsed data...',
        filesProcessed: uploadedFilesList.length,
        totalFiles: uploadedFilesList.length
      });

      // Validate data using the new modular system
      const allIssues = validateData(newParsedData);

      // Always store the parsed data (whether AI-enhanced or not)
      setParsedData(newParsedData);
      setErrors(newErrors);

      // Create summary if AI mappings were applied
      if (aiMappingsApplied.length > 0) {
        const totalMappings = aiMappingsApplied.reduce((sum, file) => sum + file.mappings.length, 0);
        setParsingSummary({
          aiMappingsApplied,
          totalFiles: uploadedFilesList.length,
          totalMappings
        });
        setParsingComplete(true);
        setLoading(false);
      } else {
        setValidationIssues(allIssues);
        setLoading(false);
      }
    }, [uploadedFiles, validateData, getColumnMappingSuggestions, applyColumnMappings]);

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
    if (issue.row === -1 && issue.column && issue.sheet) {
      // Highlight the header for missing/unexpected columns
      setHighlightedHeaders([{ sheet: issue.sheet, header: issue.column }]);
      
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

  // Column mapping dialog handlers
  const handleAcceptMappings = useCallback(async () => {
    if (!columnMappingSuggestions || !currentMappingFile) return;

    console.log(`✅ User accepted AI column mappings for ${currentMappingFile}`);
    
    // Apply the mappings to the current parsed data
    const currentData = parsedData[currentMappingFile];
    if (currentData) {
      const mappedData = applyColumnMappings(currentData, columnMappingSuggestions.mappings);
      
      // Update the parsed data
      const updatedParsedData = {
        ...parsedData,
        [currentMappingFile]: mappedData
      };
      
      setParsedData(updatedParsedData);
      
      // Re-validate with the new data
      const newIssues = validateData(updatedParsedData);
      setValidationIssues(newIssues);
    }

    // Close dialog
    setShowColumnMappingDialog(false);
    setColumnMappingSuggestions(null);
    setCurrentMappingFile(null);
  }, [columnMappingSuggestions, currentMappingFile, parsedData, applyColumnMappings, validateData]);

  const handleRejectMappings = useCallback(() => {
    console.log('❌ User rejected AI column mappings');
    setShowColumnMappingDialog(false);
    setColumnMappingSuggestions(null);
    setCurrentMappingFile(null);
  }, []);

  const handleParsingSummaryConfirm = useCallback(() => {
    console.log('✅ User confirmed parsing summary, proceeding to validation');
    setParsingComplete(false);
    setParsingSummary(null);
    
    // Re-validate the already stored data and set validation issues
    const allIssues = validateData(parsedData);
    setValidationIssues(allIssues);
  }, [parsedData, validateData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-6"></div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Processing Your Files
          </h2>
          
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm text-gray-500">
                  {parsingProgress.filesProcessed} of {parsingProgress.totalFiles} files
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${parsingProgress.totalFiles > 0 ? (parsingProgress.filesProcessed / parsingProgress.totalFiles) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-2">
              {parsingProgress.currentFile && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {parsingProgress.currentFile}
                  </span>
                </div>
              )}
              <p className="text-sm text-gray-600">{parsingProgress.step}</p>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            LLM is analyzing your data for optimal column mapping
          </div>
        </div>
      </div>
    );
  }

  // Show parsing summary screen
  if (parsingComplete && parsingSummary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Files Processed Successfully! 🎉
              </h2>
              <p className="text-gray-600">
                AI has intelligently mapped your column headers for better data validation.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                  🤖 AI Column Mapping Summary
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{parsingSummary.totalFiles}</div>
                    <div className="text-sm text-gray-600">Files Processed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{parsingSummary.aiMappingsApplied.length}</div>
                    <div className="text-sm text-gray-600">Files Enhanced</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{parsingSummary.totalMappings}</div>
                    <div className="text-sm text-gray-600">Columns Mapped</div>
                  </div>
                </div>
              </div>

              {parsingSummary.aiMappingsApplied.map((fileMapping, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 capitalize">
                      📋 {fileMapping.file} File
                    </h4>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      {Math.round(fileMapping.confidence * 100)}% confidence
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {fileMapping.mappings.map((mapping, mappingIndex) => (
                      <div key={mappingIndex} className="flex items-center text-sm">
                        <span className="font-mono bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                          {mapping.from}
                        </span>
                        <svg className="w-4 h-4 mx-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="font-mono bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                          {mapping.to}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-4">
                  These changes have been automatically applied to improve data validation accuracy.
                </p>
                <button
                  onClick={handleParsingSummaryConfirm}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Okay, Continue to Validation
                </button>
              </div>
            </div>
          </div>
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

      {/* AI Column Mapping Dialog */}
      {showColumnMappingDialog && columnMappingSuggestions && currentMappingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                🤖 AI Column Mapping Suggestions
              </h3>
              <button
                onClick={handleRejectMappings}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                AI detected potentially misnamed columns in your <strong>{currentMappingFile}</strong> file. 
                Here are intelligent mapping suggestions:
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center text-sm text-blue-800">
                  <div className="flex-shrink-0 w-16 text-right font-medium">Confidence:</div>
                  <div className="ml-2">
                    <div className="flex items-center">
                      <div className="w-24 bg-blue-200 rounded-full h-2 mr-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.round(columnMappingSuggestions.confidence * 100)}%` }}
                        ></div>
                      </div>
                      <span className="font-semibold">{Math.round(columnMappingSuggestions.confidence * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="font-medium text-gray-900">Suggested Mappings:</h4>
              {columnMappingSuggestions.mappings?.map((mapping, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="text-sm">
                      <span className="font-mono bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                        {mapping.originalHeader}
                      </span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="font-mono bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        {mapping.suggestedHeader}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {Math.round(mapping.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
              
              {columnMappingSuggestions.unmappedColumns?.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Unmapped Columns:</h5>
                  <div className="flex flex-wrap gap-2">
                    {columnMappingSuggestions.unmappedColumns.map((col: string, index: number) => (
                      <span key={index} className="font-mono bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {columnMappingSuggestions.missingColumns?.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Still Missing:</h5>
                  <div className="flex flex-wrap gap-2">
                    {columnMappingSuggestions.missingColumns.map((col: string, index: number) => (
                      <span key={index} className="font-mono bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleRejectMappings}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Keep Original Headers
              </button>
              <button
                onClick={handleAcceptMappings}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Apply AI Suggestions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}