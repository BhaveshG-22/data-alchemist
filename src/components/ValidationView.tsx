'use client';

import { useState, useEffect, useCallback } from 'react';
import TabbedDataView from './TabbedDataView';
import IssuesSidebar from './IssuesSidebar';
import RuleInputUI from './RuleInputUI';
import NaturalLanguageQuery from './NaturalLanguageQuery';
import NLDataModifier from './NLDataModifier';
import FilteredDataView from './FilteredDataView';
import PrioritizationWeights from './PrioritizationWeights';
import ExportButton from './ExportButton';
// import ValidationSummary from './ValidationSummary';
import { parseFile, ParsedData } from '@/utils/fileParser';
import {
  runAllValidations,
  ValidationIssue,
  ValidatorContext,
  ParsedData as ValidatedParsedData,
  BusinessRule
} from '@/validators';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Drawer from 'react-modern-drawer';
import 'react-modern-drawer/dist/index.css';
import { PrioritizationConfig, DEFAULT_PRIORITIZATION_CONFIG } from '@/config/prioritizationCriteria';

interface QueryResult {
  query: string;
  sheet: 'clients' | 'workers' | 'tasks';
  filteredRows: Record<string, unknown>[];
  totalRows: number;
  filterFunction: string;
}

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
  const [hoveredIssue, setHoveredIssue] = useState<{ row: number; column: string; issueType?: 'error' | 'warning' | 'info'; category?: string } | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [targetRow, setTargetRow] = useState<number | undefined>(undefined);
  const [recentlyUpdatedCells, setRecentlyUpdatedCells] = useState<Array<{ sheet: string; row: number; column: string; timestamp: number }>>([]);

  // Reset targetRow when component mounts and scroll to top to prevent unwanted navigation
  useEffect(() => {
    setTargetRow(undefined);
    // Scroll to top when validation view loads
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Reset targetRow when switching tabs to prevent unwanted navigation
  useEffect(() => {
    setTargetRow(undefined);
  }, [activeTab]);

  // Helper function to mark a cell as recently updated
  const markCellAsUpdated = useCallback((sheet: string, row: number, column: string) => {
    const timestamp = Date.now();
    setRecentlyUpdatedCells(prev => {
      // Remove any existing entry for this cell and add new one
      const filtered = prev.filter(cell => !(cell.sheet === sheet && cell.row === row && cell.column === column));
      return [...filtered, { sheet, row, column, timestamp }];
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setRecentlyUpdatedCells(prev =>
        prev.filter(cell => !(cell.sheet === sheet && cell.row === row && cell.column === column && cell.timestamp === timestamp))
      );
    }, 5000);
  }, []);

  // Clean up old recently updated cells periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentlyUpdatedCells(prev => prev.filter(cell => now - cell.timestamp < 5000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([]);
  const [showRuleDrawer, setShowRuleDrawer] = useState(false);
  const [prioritizationConfig, setPrioritizationConfig] = useState<PrioritizationConfig>(DEFAULT_PRIORITIZATION_CONFIG);
  const [showPrioritizationDrawer, setShowPrioritizationDrawer] = useState(false);
  const [showColumnMappingDialog, setShowColumnMappingDialog] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [showFilteredData, setShowFilteredData] = useState(false);
  const [columnMappingSuggestions, setColumnMappingSuggestions] = useState<{
    mappings: Array<{ originalHeader: string; suggestedHeader: string; confidence: number; reasoning: string }>;
    unmappedColumns: string[];
    missingColumns: string[];
    confidence: number;
  } | null>(null);
  const [currentMappingFile, setCurrentMappingFile] = useState<'clients' | 'workers' | 'tasks' | null>(null);

  // New modular validation using the validators module
  const validateData = useCallback((parsedData: { clients: ParsedData | null; workers: ParsedData | null; tasks: ParsedData | null }, rules: BusinessRule[] = []): ValidationIssue[] => {
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
      rules: rules.filter(rule => rule.active), // Only pass active rules
      config: {
        strictMode: false,
        autoFix: false,
        skipWarnings: false
      }
    };

    console.log('📊 Validation context:', context);
    console.log('📋 Active business rules:', rules.filter(rule => rule.active));

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
            step: `Analyzing ${fileType} columns`,
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
    const allIssues = validateData(newParsedData, businessRules);

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
      setTargetRow(undefined); // Clear target row after parsing
    } else {
      setValidationIssues(allIssues);
      setLoading(false);
      setTargetRow(undefined); // Clear target row after validation
    }
  }, [uploadedFiles, validateData, getColumnMappingSuggestions, applyColumnMappings]);

  useEffect(() => {
    parseFiles();
  }, [uploadedFiles, parseFiles]);

  // Re-validate when business rules change (without re-parsing files)
  useEffect(() => {
    if (parsedData.clients || parsedData.workers || parsedData.tasks) {
      const allIssues = validateData(parsedData, businessRules);
      setValidationIssues(allIssues);
      setTargetRow(undefined); // Clear target row after re-validation
    }
  }, [businessRules, parsedData, validateData]);

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
    const newIssues = validateData(updatedParsedData, businessRules);
    setValidationIssues(newIssues);
  };

  const handleIssueClick = (issue: ValidationIssue) => {
    console.log('🎯 Issue clicked:', issue);

    // Clear any existing timeout and dismiss toasts
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    toast.dismiss();

    // Switch to the relevant tab first if needed
    if (issue.sheet && issue.sheet !== activeTab) {
      console.log(`🔄 Switching to ${issue.sheet} sheet`);
      setActiveTab(issue.sheet as 'clients' | 'workers' | 'tasks');
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
    // Handle regular cell highlighting and navigation
    else if (issue.row !== undefined && issue.column) {
      console.log(`🧭 Navigating to row ${issue.row + 1}, column ${issue.column}`)

      // Navigate to the page containing this row
      if (issue.sheet && issue.sheet !== activeTab) {
        // Different sheet - wait for tab switch then set target
        setTimeout(() => {
          setTargetRow(issue.row);
        }, 100);
      } else {
        // Same sheet - immediate navigation
        setTargetRow(issue.row);
      }

      setHoveredIssue({
        row: issue.row,
        column: issue.column,
        issueType: issue.type,
        category: issue.category
      });

      // Set timeout to auto-remove hover after 4 seconds
      const timeoutId = setTimeout(() => {
        setHoveredIssue(null);
        setTargetRow(undefined);
        setHoverTimeout(null);
      }, 4000);

      setHoverTimeout(timeoutId);
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
      const rowsPerPage = 100; // Standard pagination size
      const targetPage = Math.ceil((issue.row + 1) / rowsPerPage);
      const isCurrentSheet = issue.sheet === activeTab;

      // Always highlight immediately for same sheet issues
      if (isCurrentSheet) {
        setHoveredIssue({
          row: issue.row,
          column: issue.column,
          issueType: issue.type,
          category: issue.category
        });

        // Auto-scroll to the cell if it's not visible, regardless of page
        const scrollToCellIfNeeded = () => {
          console.log(`🔍 Looking for cell at row ${issue.row}, column ${issue.column} on sheet ${issue.sheet}`);

          // Try multiple selectors to find the cell in the DOM
          const cellSelector1 = `[data-row="${issue.row}"][data-column="${issue.column}"]`;
          const cellSelector2 = `[data-cell-id="cell-${issue.row}-${issue.column}"]`;

          console.log(`🔍 Using selectors: ${cellSelector1} or ${cellSelector2}`);

          let cellElement = document.querySelector(cellSelector1);
          if (!cellElement) {
            cellElement = document.querySelector(cellSelector2);
          }
          console.log(`🔍 Cell element found:`, cellElement);

          if (cellElement) {
            // Get the main content area that contains the scrollable table
            // Try multiple approaches to find the scrollable container
            let mainContentArea = cellElement.closest('.overflow-y-auto, .overflow-auto');

            // If no overflow container found, try data table specific selectors
            if (!mainContentArea) {
              const dataTableContainer = cellElement.closest('[class*="rdt_Table"]');
              mainContentArea = dataTableContainer?.closest('.overflow-y-auto, .overflow-auto') || null;
            }

            // If still not found, look for the main validation view container
            if (!mainContentArea) {
              mainContentArea = document.querySelector('.flex-1.p-6.space-y-6.overflow-y-auto');
            }

            console.log(`🔍 Main content area:`, mainContentArea, 'Found via:',
              cellElement.closest('.overflow-y-auto, .overflow-auto') ? 'direct parent' :
                cellElement.closest('[class*="rdt_Table"]')?.closest('.overflow-y-auto, .overflow-auto') ? 'data table parent' :
                  'document query');

            if (mainContentArea) {
              // Check if cell is visible within the scrollable container
              const cellRect = cellElement.getBoundingClientRect();
              const containerRect = mainContentArea.getBoundingClientRect();

              console.log(`🔍 Cell rect:`, cellRect);
              console.log(`🔍 Container rect:`, containerRect);

              // More comprehensive visibility detection with margin for better UX
              const margin = 20; // Add some margin to consider cells "visible" if they're close
              const isVisibleVertically = 
                cellRect.top >= (containerRect.top - margin) && 
                cellRect.bottom <= (containerRect.bottom + margin);
              const isVisibleHorizontally = 
                cellRect.left >= (containerRect.left - margin) && 
                cellRect.right <= (containerRect.right + margin);
              const isVisible = isVisibleVertically && isVisibleHorizontally;

              // Determine scroll position based on cell location relative to container
              const isCellAbove = cellRect.bottom < containerRect.top;
              const isCellBelow = cellRect.top > containerRect.bottom;
              const isCellLeft = cellRect.right < containerRect.left;
              const isCellRight = cellRect.left > containerRect.right;

              console.log(`🔍 Cell visibility:`, {
                isVisible,
                isVisibleVertically,
                isVisibleHorizontally,
                isCellAbove,
                isCellBelow,
                isCellLeft,
                isCellRight,
                cellRect: { top: cellRect.top, bottom: cellRect.bottom, left: cellRect.left, right: cellRect.right },
                containerRect: { top: containerRect.top, bottom: containerRect.bottom, left: containerRect.left, right: containerRect.right }
              });

              if (!isVisible) {
                console.log(`🔄 Auto-scrolling to cell at row ${issue.row !== undefined ? issue.row + 1 : 'unknown'}, column ${issue.column}`);

                // Determine the best scroll position based on where the cell is located
                let scrollPosition: 'start' | 'center' | 'end' | 'nearest';

                if (isCellBelow) {
                  scrollPosition = 'end';  // Cell is below viewport, scroll to bottom
                } else if (isCellAbove) {
                  scrollPosition = 'start'; // Cell is above viewport, scroll to top
                } else {
                  scrollPosition = 'center'; // Cell is partially visible or to the side, center it
                }

                console.log(`🔍 Scroll direction: ${isCellBelow ? 'below (end)' : isCellAbove ? 'above (start)' : 'side/partial (center)'}, using scroll position: ${scrollPosition}`);

                // Show a more subtle scrolling indicator
                console.log(`📍 Scrolling to row ${issue.row !== undefined ? issue.row + 1 : 'unknown'}`);
                
                // Add a brief toast for feedback - shorter duration
                toast.info(`Scrolling to row ${issue.row !== undefined ? issue.row + 1 : 'unknown'}`, {
                  position: "bottom-right",
                  autoClose: 1000,
                  hideProgressBar: true,
                  closeOnClick: true,
                  pauseOnHover: false,
                  draggable: false,
                  toastId: `scroll-${issue.row}-${issue.column}`,
                });

                // Scroll within the container with the determined scroll position
                cellElement.scrollIntoView({
                  behavior: 'smooth',
                  block: scrollPosition,
                  inline: 'center'
                });
              } else {
                console.log(`✅ Cell is already visible, no scrolling needed`);
              }
            } else {
              // Enhanced fallback to viewport scrolling with better container detection
              console.log(`🔍 No scrollable container found via closest(), trying alternative approaches`);

              // Try to find any scrollable container in the document that might contain our cell
              const potentialContainers = document.querySelectorAll('.overflow-y-auto, .overflow-auto, [style*="overflow"]');
              let bestContainer = null;

              for (const container of potentialContainers) {
                if (container.contains(cellElement)) {
                  bestContainer = container;
                  console.log(`🔍 Found containing scrollable element:`, container);
                  break;
                }
              }

              if (bestContainer) {
                // Use the found container instead of viewport
                const cellRect = cellElement.getBoundingClientRect();
                const containerRect = bestContainer.getBoundingClientRect();

                const isVisibleVertically = cellRect.top >= containerRect.top && cellRect.bottom <= containerRect.bottom;
                const isVisibleHorizontally = cellRect.left >= containerRect.left && cellRect.right <= containerRect.right;
                const isVisible = isVisibleVertically && isVisibleHorizontally;

                const isCellAbove = cellRect.bottom < containerRect.top;
                const isCellBelow = cellRect.top > containerRect.bottom;

                console.log(`🔍 Using alternative container - Cell visibility:`, {
                  isVisible,
                  isCellAbove,
                  isCellBelow
                });

                if (!isVisible) {
                  const scrollPosition: 'start' | 'center' | 'end' | 'nearest' = isCellBelow ? 'end' : isCellAbove ? 'start' : 'center';

                  console.log(`🔄 Alternative container scroll at row ${issue.row !== undefined ? issue.row + 1 : 'unknown'}, position: ${scrollPosition}`);

                  toast.info(`📍 Scrolling to row ${issue.row !== undefined ? issue.row + 1 : 'unknown'}`, {
                    position: "bottom-right",
                    autoClose: 2000,
                    hideProgressBar: true,
                    closeOnClick: true,
                    pauseOnHover: false,
                    draggable: false,
                    toastId: `scroll-${issue.row}-${issue.column}`,
                  });

                  cellElement.scrollIntoView({
                    behavior: 'smooth',
                    block: scrollPosition,
                    inline: 'center'
                  });
                } else {
                  console.log(`✅ Cell is already visible in alternative container, no scrolling needed`);
                }
              } else {
                // Final fallback to viewport scrolling
                console.log(`🔍 No containing scrollable element found, using viewport scrolling`);
                const rect = cellElement.getBoundingClientRect();

                const isVisibleVertically = rect.top >= 0 && rect.bottom <= window.innerHeight;
                const isVisibleHorizontally = rect.left >= 0 && rect.right <= window.innerWidth;
                const isVisible = isVisibleVertically && isVisibleHorizontally;

                const isCellAbove = rect.bottom < 0;
                const isCellBelow = rect.top > window.innerHeight;

                console.log(`🔍 Viewport visibility:`, {
                  isVisible,
                  isVisibleVertically,
                  isVisibleHorizontally,
                  isCellAbove,
                  isCellBelow,
                  windowHeight: window.innerHeight,
                  cellTop: rect.top,
                  cellBottom: rect.bottom
                });

                if (!isVisible) {
                  const scrollPosition: 'start' | 'center' | 'end' | 'nearest' = isCellBelow ? 'end' : isCellAbove ? 'start' : 'center';

                  console.log(`🔄 Viewport scroll at row ${issue.row !== undefined ? issue.row + 1 : 'unknown'}, position: ${scrollPosition}`);

                  toast.info(`📍 Scrolling to row ${issue.row !== undefined ? issue.row + 1 : 'unknown'}`, {
                    position: "bottom-right",
                    autoClose: 2000,
                    hideProgressBar: true,
                    closeOnClick: true,
                    pauseOnHover: false,
                    draggable: false,
                    toastId: `scroll-${issue.row}-${issue.column}`,
                  });

                  cellElement.scrollIntoView({
                    behavior: 'smooth',
                    block: scrollPosition,
                    inline: 'nearest'
                  });
                } else {
                  console.log(`✅ Cell is already visible in viewport, no scrolling needed`);
                }
              }
            }
          } else {
            console.log(`❌ Cell not found with selectors ${cellSelector1} or ${cellSelector2}, checking all data-row elements`);
            const allRowElements = document.querySelectorAll('[data-row]');
            console.log(`🔍 Found ${allRowElements.length} elements with data-row attribute`);
            allRowElements.forEach((el, index) => {
              if (index < 5) { // Log first 5 for debugging
                console.log(`  - Element ${index}: data-row="${el.getAttribute('data-row')}", data-column="${el.getAttribute('data-column')}"`);
              }
            });

            // Cell not found, probably on different page - use existing navigation
            console.log(`🧭 Using setTargetRow fallback for row ${issue.row}`);
            setTargetRow(issue.row);
          }
        };

        // Check if we need to navigate to a different page first
        const currentPage = Math.ceil((issue.row + 1) / rowsPerPage);
        console.log(`🧭 Issue row ${issue.row + 1} should be on page ${currentPage}`);
        
        // Always set target row for navigation
        setTargetRow(issue.row);
        
        // Set up delayed scroll with multiple attempts to account for page navigation
        const attemptScroll = (attemptNumber: number, maxAttempts: number = 3) => {
          const delay = attemptNumber === 1 ? 200 : attemptNumber * 300;
          
          const timeoutId = setTimeout(() => {
            console.log(`🔄 Scroll attempt ${attemptNumber}/${maxAttempts} after ${delay}ms`);
            
            const cellSelector1 = `[data-row="${issue.row}"][data-column="${issue.column}"]`;
            const cellSelector2 = `[data-cell-id="cell-${issue.row}-${issue.column}"]`;
            let cellElement = document.querySelector(cellSelector1) || document.querySelector(cellSelector2);
            
            if (cellElement) {
              console.log(`✅ Cell found on attempt ${attemptNumber}, scrolling...`);
              cellElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
              });
            } else if (attemptNumber < maxAttempts) {
              console.log(`❌ Cell not found on attempt ${attemptNumber}, trying again...`);
              attemptScroll(attemptNumber + 1, maxAttempts);
            } else {
              console.log(`❌ Cell not found after ${maxAttempts} attempts, giving up`);
            }
          }, delay);
          
          // Store the timeout for cleanup (only store the first one)
          if (attemptNumber === 1) {
            setHoverTimeout(timeoutId);
          }
        };
        
        // Start the scroll attempts
        attemptScroll(1);
      } else {
        // For different sheet, auto-navigate without toast
        console.log(`🧭 Auto-navigating to ${issue.sheet} sheet, row ${issue.row + 1}, page ${targetPage}`);

        if (issue.sheet && issue.sheet !== activeTab) {
          setActiveTab(issue.sheet as 'clients' | 'workers' | 'tasks');
        }

        setTimeout(() => {
          setTargetRow(issue.row);
        }, 100);
      }
    }
  };


  const handleIssueUnhover = () => {
    // Clear any existing timeout (including toast delay timeout)
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    setHoveredIssue(null);
    // Toast will persist if already shown and can be interacted with
  };

  const handleApplyAIFix = async (issue: ValidationIssue, aiSuggestion?: string) => {
    console.log('AI fix requested for issue:', issue);
    console.log('AI suggestion:', aiSuggestion);

    if (!aiSuggestion) {
      console.log('No AI suggestion provided');
      return;
    }

    // Handle JSON field fixes
    if (issue.category === 'json_fields' && issue.row !== undefined && issue.column && issue.sheet) {
      try {
        // Extract the JSON fix from the AI suggestion - try multiple patterns
        let fixedValue = '';

        // Pattern 1: 💡 **Fix**: {...}
        let fixMatch = aiSuggestion.match(/💡\s*\*\*Fix\*\*:\s*(.+?)(?=\n\n|\n📊|\n✅|$)/);

        // Pattern 2: Fix: {...} (simple format without quotes/asterisks)
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/Fix:\s*(.+?)(?=\n\n|\n[📊✅]|$)/);
        }

        // Pattern 3: Look for any JSON object in the response (handle nested objects)
        if (!fixMatch) {
          const jsonRegex = /(\{(?:[^{}]|{[^{}]*})*\})/;
          fixMatch = aiSuggestion.match(jsonRegex);
        }

        if (!fixMatch) {
          console.error('Could not extract fix from AI suggestion:', aiSuggestion);
          return;
        }

        fixedValue = fixMatch[1].trim();

        // Remove quotes if they wrap the entire JSON
        if (fixedValue.startsWith('"') && fixedValue.endsWith('"')) {
          fixedValue = fixedValue.slice(1, -1);
        }

        // Validate the fixed JSON
        try {
          JSON.parse(fixedValue);
        } catch (jsonError) {
          console.error('AI suggested fix is not valid JSON:', fixedValue, 'Error:', jsonError);
          return;
        }

        // Apply the fix to the data
        const sheetName = issue.sheet as 'clients' | 'workers' | 'tasks';
        const currentSheetData = parsedData[sheetName];

        if (!currentSheetData) {
          console.error('Sheet data not found:', sheetName);
          return;
        }

        // Create a copy of the data with the fix applied
        const updatedRows = [...currentSheetData.rows];
        if (updatedRows[issue.row] && issue.column) {
          updatedRows[issue.row] = {
            ...updatedRows[issue.row],
            [issue.column]: fixedValue
          };
        }

        const updatedSheetData = {
          ...currentSheetData,
          rows: updatedRows
        };

        // Update the data using the existing handler
        await handleDataChange(sheetName)(updatedSheetData);

        // Mark cell as recently updated and clear hover state after a short delay
        markCellAsUpdated(sheetName, issue.row, issue.column);

        // Clear hover state after a brief moment to let user see the green background
        setTimeout(() => {
          setHoveredIssue(null);
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
          }
        }, 1000);

        console.log(`✅ Applied AI fix to ${sheetName} sheet, row ${issue.row + 1}, column ${issue.column}`);
      } catch (error) {
        console.error('Error applying AI fix:', error);
      }
    }
    // Handle malformed list fixes
    else if (issue.category === 'malformed_lists' && issue.row !== undefined && issue.column && issue.sheet) {
      try {
        // Extract the list fix from the AI suggestion
        let fixedValue = '';

        // Pattern 1: 💡 **Fix**: [1,2,3] or "skill1,skill2,skill3"
        let fixMatch = aiSuggestion.match(/💡\s*\*\*Fix\*\*:\s*(.+?)(?=\n\n|\n📝|\n✅|$)/);

        // Pattern 2: Look for comma-separated values or arrays
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/["\*]*Fix["\*]*:\s*(.+?)(?=\n\n|\n[📝✅]|$)/);
        }

        // Pattern 3: Look for any array or comma-separated list in the response
        if (!fixMatch) {
          // First try to find array format
          const arrayMatch = aiSuggestion.match(/(\[[^\]]+\])/);
          if (arrayMatch) {
            fixMatch = [arrayMatch[0], arrayMatch[1]];
          } else {
            // Then try comma-separated format
            const commaMatch = aiSuggestion.match(/("?[a-zA-Z0-9_,\s-]+"?)/);
            if (commaMatch) {
              fixMatch = [commaMatch[0], commaMatch[1]];
            }
          }
        }

        if (!fixMatch) {
          console.error('Could not extract fix from AI suggestion:', aiSuggestion);
          return;
        }

        fixedValue = fixMatch[1].trim();

        // Remove outer quotes if they wrap the entire value
        if (fixedValue.startsWith('"') && fixedValue.endsWith('"')) {
          fixedValue = fixedValue.slice(1, -1);
        }

        // Validate the fixed list based on column type
        if (issue.column === 'AvailableSlots') {
          // For numeric lists, validate as array or comma-separated numbers
          if (fixedValue.startsWith('[') && fixedValue.endsWith(']')) {
            try {
              const parsed = JSON.parse(fixedValue);
              if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'number')) {
                console.error('AI suggested fix is not a valid numeric array:', fixedValue);
                return;
              }
            } catch (parseError) {
              console.error('AI suggested array fix is not valid JSON:', fixedValue);
              return;
            }
          } else {
            // Validate comma-separated format
            const items = fixedValue.split(',').map(s => s.trim());
            const hasInvalidNumbers = items.some(item => isNaN(Number(item)) || item === '');
            if (hasInvalidNumbers) {
              console.error('AI suggested fix contains invalid numbers:', fixedValue);
              return;
            }
          }
        }

        // Apply the fix to the data
        const sheetName = issue.sheet as 'clients' | 'workers' | 'tasks';
        const currentSheetData = parsedData[sheetName];

        if (!currentSheetData) {
          console.error('Sheet data not found:', sheetName);
          return;
        }

        // Create a copy of the data with the fix applied
        const updatedRows = [...currentSheetData.rows];
        if (updatedRows[issue.row] && issue.column) {
          updatedRows[issue.row] = {
            ...updatedRows[issue.row],
            [issue.column]: fixedValue
          };
        }

        const updatedSheetData = {
          ...currentSheetData,
          rows: updatedRows
        };

        // Update the data using the existing handler
        await handleDataChange(sheetName)(updatedSheetData);

        // Mark cell as recently updated and clear hover state after a short delay
        markCellAsUpdated(sheetName, issue.row, issue.column);

        // Clear hover state after a brief moment to let user see the green background
        setTimeout(() => {
          setHoveredIssue(null);
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
          }
        }, 1000);

        console.log(`✅ Applied AI list fix to ${sheetName} sheet, row ${issue.row + 1}, column ${issue.column}`);
      } catch (error) {
        console.error('Error applying AI list fix:', error);
      }
    }
    // Handle reference validation fixes
    else if (issue.category === 'references' && issue.row !== undefined && issue.column && issue.sheet) {
      try {
        // Get the current value to understand what we're working with
        const sheetName = issue.sheet as 'clients' | 'workers' | 'tasks';
        const currentSheetData = parsedData[sheetName];

        if (!currentSheetData) {
          console.error('Sheet data not found:', sheetName);
          return;
        }

        const currentValue = String(currentSheetData.rows[issue.row]?.[issue.column] || '');
        console.log('Current value:', currentValue);
        console.log('Invalid reference:', issue.value);

        let fixedValue = '';

        // Check if AI is suggesting removal of invalid reference
        if (aiSuggestion.includes('Remove') && aiSuggestion.includes('invalid reference')) {
          // Parse current comma-separated list and remove the invalid reference
          const currentIds = currentValue.split(',').map((id: string) => id.trim()).filter(Boolean);

          // Extract the specific invalid reference from the issue or AI suggestion
          let invalidRef = String(issue.value || '');

          // Try to extract invalid reference from AI suggestion if not in issue
          if (!invalidRef) {
            const refMatch = aiSuggestion.match(/['"]([^'"]+)['"]/);
            if (refMatch) {
              invalidRef = refMatch[1];
            }
          }

          console.log('Current IDs:', currentIds);
          console.log('Removing invalid reference:', invalidRef);

          const validIds = currentIds.filter((id: string) => id !== invalidRef);
          fixedValue = validIds.join(',');

          console.log('Remaining valid IDs:', validIds);
          console.log('Fixed value:', fixedValue);
        } else {
          // Try to extract replacement task IDs from AI suggestion
          let fixMatch = aiSuggestion.match(/💡\s*\*\*Fix\*\*:\s*(.+?)(?=\n\n|\n🔗|\n📋|$)/);

          // Pattern 2: Look for task ID lists
          if (!fixMatch) {
            fixMatch = aiSuggestion.match(/["\*]*Fix["\*]*:\s*(.+?)(?=\n\n|\n[🔗📋]|$)/);
          }

          // Pattern 3: Look for comma-separated task IDs in the response
          if (!fixMatch) {
            const taskIdMatch = aiSuggestion.match(/(T\d+(?:,T\d+)*)/);
            if (taskIdMatch) {
              fixMatch = [taskIdMatch[0], taskIdMatch[1]];
            }
          }

          if (fixMatch) {
            fixedValue = fixMatch[1].trim();

            // Remove outer quotes if they wrap the entire value
            if (fixedValue.startsWith('"') && fixedValue.endsWith('"')) {
              fixedValue = fixedValue.slice(1, -1);
            }

            // If the fix contains removal instruction, parse and remove the invalid reference
            if (fixedValue.includes('Remove') && (fixedValue.includes('invalid reference') || fixedValue.includes('invalid') || fixedValue.includes('reference'))) {
              console.log('AI suggestion contains removal instruction, parsing to remove invalid reference');

              // Extract the invalid reference from the fix instruction
              let invalidRef = String(issue.value || '');
              const refMatch = fixedValue.match(/['"]([^'"]+)['"]/);
              if (refMatch) {
                invalidRef = refMatch[1];
              }

              console.log('Extracted invalid reference to remove:', invalidRef);

              const currentIds = currentValue.split(',').map((id: string) => id.trim()).filter(Boolean);
              const validIds = currentIds.filter((id: string) => id !== invalidRef);
              fixedValue = validIds.join(',');

              console.log('Removal result - Valid IDs:', validIds);
            }
          } else {
            console.error('Could not extract reference fix from AI suggestion:', aiSuggestion);
            return;
          }
        }

        console.log('Final fixed value:', fixedValue);

        // Create a copy of the data with the fix applied
        const updatedRows = [...currentSheetData.rows];
        if (updatedRows[issue.row] && issue.column) {
          updatedRows[issue.row] = {
            ...updatedRows[issue.row],
            [issue.column]: fixedValue
          };
        }

        const updatedSheetData = {
          ...currentSheetData,
          rows: updatedRows
        };

        // Update the data using the existing handler
        await handleDataChange(sheetName)(updatedSheetData);

        // Mark cell as recently updated and clear hover state after a short delay
        markCellAsUpdated(sheetName, issue.row, issue.column);

        // Clear hover state after a brief moment to let user see the green background
        setTimeout(() => {
          setHoveredIssue(null);
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
          }
        }, 1000);

        console.log(`✅ Applied AI reference fix to ${sheetName} sheet, row ${issue.row + 1}, column ${issue.column}`);
      } catch (error) {
        console.error('Error applying AI reference fix:', error);
      }
    }
    // Handle out of range validation fixes
    else if (issue.category === 'out_of_range' && issue.row !== undefined && issue.column && issue.sheet) {
      try {
        // Extract the fixed value from the AI suggestion
        let fixedValue = '';

        // Pattern 1: 💡 Fix:1 (exactly as shown in screenshot)
        let fixMatch = aiSuggestion.match(/💡\s*Fix:\s*(\d+(?:\.\d+)?)/);

        // Pattern 2: 💡 **Fix**: 1 (with bold formatting)
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/💡\s*\*\*Fix\*\*:\s*(\d+(?:\.\d+)?)/);
        }

        // Pattern 3: Generic Fix: pattern
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/Fix:\s*(\d+(?:\.\d+)?)/);
        }

        // Pattern 4: Look for just a standalone number after 💡
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/💡[^0-9]*(\d+(?:\.\d+)?)/);
        }

        // Pattern 5: Last resort - any number in the suggestion
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/(\d+(?:\.\d+)?)/);
        }

        if (!fixMatch) {
          console.error('Could not extract numeric fix from AI suggestion:', aiSuggestion);
          return;
        }

        fixedValue = fixMatch[1].trim();

        // Validate that the fixed value is actually a number
        const numericValue = parseFloat(fixedValue);
        if (isNaN(numericValue)) {
          console.error('AI suggested fix is not a valid number:', fixedValue);
          return;
        }

        console.log(`Applying out-of-range fix: ${fixedValue} for column ${issue.column}`);

        // Apply the fix to the data
        const sheetName = issue.sheet as 'clients' | 'workers' | 'tasks';
        const currentSheetData = parsedData[sheetName];

        if (!currentSheetData) {
          console.error('Sheet data not found:', sheetName);
          return;
        }

        // Create a copy of the data with the fix applied
        const updatedRows = [...currentSheetData.rows];
        if (updatedRows[issue.row] && issue.column) {
          updatedRows[issue.row] = {
            ...updatedRows[issue.row],
            [issue.column]: fixedValue
          };
        }

        const updatedSheetData = {
          ...currentSheetData,
          rows: updatedRows
        };

        // Update the data using the existing handler
        await handleDataChange(sheetName)(updatedSheetData);

        // Mark cell as recently updated and clear hover state after a short delay
        markCellAsUpdated(sheetName, issue.row, issue.column);

        // Clear hover state after a brief moment to let user see the green background
        setTimeout(() => {
          setHoveredIssue(null);
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
          }
        }, 1000);

        console.log(`✅ Applied AI out-of-range fix to ${sheetName} sheet, row ${issue.row + 1}, column ${issue.column}`);
      } catch (error) {
        console.error('Error applying AI out-of-range fix:', error);
      }
    }
    // Handle duplicate ID validation fixes
    else if (issue.category === 'duplicate_ids' && issue.row !== undefined && issue.column && issue.sheet) {
      try {
        // Extract the new unique ID from the AI suggestion
        let fixedValue = '';

        // Pattern 1: 💡 Fix:CLIENT_024 or 💡 Fix:client_062 (case insensitive)
        let fixMatch = aiSuggestion.match(/💡\s*Fix:\s*([A-Za-z_0-9]+)/i);

        // Pattern 2: 💡 **Fix**: CLIENT_024 or client_062 (with bold formatting)
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/💡\s*\*\*Fix\*\*:\s*([A-Za-z_0-9]+)/i);
        }

        // Pattern 3: Generic Fix: pattern (case insensitive)
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/Fix:\s*([A-Za-z_0-9]+)/i);
        }

        // Pattern 4: Look for ID patterns like CLIENT_024, W001, T001, client_062 etc.
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/([A-Za-z]+_?\d{2,3})/);
        }

        // Pattern 5: Look for any ID after 💡 (case insensitive)
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/💡[^A-Za-z]*([A-Za-z][A-Za-z_0-9]+)/i);
        }

        if (!fixMatch) {
          console.error('Could not extract ID fix from AI suggestion:', aiSuggestion);
          return;
        }

        fixedValue = fixMatch[1].trim();

        // Basic validation to ensure it looks like a valid ID
        if (!fixedValue || fixedValue.length < 2) {
          console.error('AI suggested fix does not look like a valid ID:', fixedValue);
          return;
        }

        console.log(`Applying duplicate ID fix: ${fixedValue} for column ${issue.column}`);

        // Apply the fix to the data
        const sheetName = issue.sheet as 'clients' | 'workers' | 'tasks';
        const currentSheetData = parsedData[sheetName];

        if (!currentSheetData) {
          console.error('Sheet data not found:', sheetName);
          return;
        }

        // Create a copy of the data with the fix applied
        const updatedRows = [...currentSheetData.rows];
        if (updatedRows[issue.row] && issue.column) {
          updatedRows[issue.row] = {
            ...updatedRows[issue.row],
            [issue.column]: fixedValue
          };
        }

        const updatedSheetData = {
          ...currentSheetData,
          rows: updatedRows
        };

        // Update the data using the existing handler
        await handleDataChange(sheetName)(updatedSheetData);

        // Mark cell as recently updated and clear hover state after a short delay
        markCellAsUpdated(sheetName, issue.row, issue.column);

        // Clear hover state after a brief moment to let user see the green background
        setTimeout(() => {
          setHoveredIssue(null);
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
          }
        }, 1000);

        console.log(`✅ Applied AI duplicate ID fix to ${sheetName} sheet, row ${issue.row + 1}, column ${issue.column}`);
      } catch (error) {
        console.error('Error applying AI duplicate ID fix:', error);
      }
    }
    // Handle concurrency feasibility fixes
    else if (issue.category === 'concurrency_feasibility' && issue.row !== undefined && issue.column && issue.sheet) {
      try {
        // Extract the fixed numeric value from the AI suggestion
        let fixedValue = '';

        // Pattern 1: 💡 Fix:2 (exactly as shown in screenshot)
        let fixMatch = aiSuggestion.match(/💡\s*\*\*Fix\*\*:\s*(\d+(?:\.\d+)?)/);

        // Pattern 2: 💡 **Fix**: 2 (with bold formatting)
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/💡\s*Fix:\s*(\d+(?:\.\d+)?)/);
        }

        // Pattern 3: Generic Fix: pattern
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/Fix:\s*(\d+(?:\.\d+)?)/);
        }

        // Pattern 4: Look for just a standalone number after 💡
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/💡[^0-9]*(\d+(?:\.\d+)?)/);
        }

        // Pattern 5: Last resort - any number in the suggestion
        if (!fixMatch) {
          fixMatch = aiSuggestion.match(/(\d+(?:\.\d+)?)/);
        }

        if (!fixMatch) {
          console.error('Could not extract numeric fix from AI suggestion:', aiSuggestion);
          return;
        }

        fixedValue = fixMatch[1].trim();

        // Validate that the fixed value is actually a number and positive
        const numericValue = parseFloat(fixedValue);
        if (isNaN(numericValue) || numericValue <= 0) {
          console.error('AI suggested fix is not a valid positive number:', fixedValue);
          return;
        }

        console.log(`Applying concurrency feasibility fix: ${fixedValue} for column ${issue.column}`);

        // Apply the fix to the data
        const sheetName = issue.sheet as 'clients' | 'workers' | 'tasks';
        const currentSheetData = parsedData[sheetName];

        if (!currentSheetData) {
          console.error('Sheet data not found:', sheetName);
          return;
        }

        // Create a copy of the data with the fix applied
        const updatedRows = [...currentSheetData.rows];
        if (updatedRows[issue.row] && issue.column) {
          updatedRows[issue.row] = {
            ...updatedRows[issue.row],
            [issue.column]: fixedValue
          };
        }

        const updatedSheetData = {
          ...currentSheetData,
          rows: updatedRows
        };

        // Update the data using the existing handler
        await handleDataChange(sheetName)(updatedSheetData);

        // Mark cell as recently updated and clear hover state after a short delay
        markCellAsUpdated(sheetName, issue.row, issue.column);

        // Clear hover state after a brief moment to let user see the green background
        setTimeout(() => {
          setHoveredIssue(null);
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
          }
        }, 1000);

        console.log(`✅ Applied AI concurrency fix to ${sheetName} sheet, row ${issue.row + 1}, column ${issue.column}`);
      } catch (error) {
        console.error('Error applying AI concurrency fix:', error);
      }
    } else {
      console.log('AI fix not implemented for this issue type:', issue.category);
      console.log('Issue:', issue);
      console.log('AI suggestion:', aiSuggestion);
    }
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
      const newIssues = validateData(updatedParsedData, businessRules);
      setValidationIssues(newIssues);
    }

    // Close dialog
    setShowColumnMappingDialog(false);
    setColumnMappingSuggestions(null);
    setCurrentMappingFile(null);
  }, [columnMappingSuggestions, currentMappingFile, parsedData, applyColumnMappings, validateData, businessRules]);

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
    const allIssues = validateData(parsedData, businessRules);
    setValidationIssues(allIssues);
  }, [parsedData, validateData, businessRules]);

  // Handle business rule changes
  const handleRulesChange = useCallback((newRules: BusinessRule[]) => {
    setBusinessRules(newRules);
    // Note: Validation will be triggered automatically by the useEffect above
  }, []);

  // Handle prioritization config changes
  const handlePrioritizationConfigChange = useCallback((config: PrioritizationConfig) => {
    setPrioritizationConfig(config);
  }, []);

  // Get available task IDs from parsed data
  const getAvailableTaskIds = useCallback((): string[] => {
    if (!parsedData.tasks || !parsedData.tasks.headers.includes('TaskID')) {
      return [];
    }

    return parsedData.tasks.rows
      .map(row => String(row.TaskID || '').trim())
      .filter(taskId => taskId !== '');
  }, [parsedData.tasks]);

  // Get available client groups from parsed data
  const getAvailableClientGroups = useCallback((): string[] => {
    if (!parsedData.clients || !parsedData.clients.headers.includes('GroupTag')) {
      return [];
    }

    const groups = parsedData.clients.rows
      .map(row => String(row.GroupTag || '').trim())
      .filter(group => group !== '');

    return [...new Set(groups)]; // Remove duplicates
  }, [parsedData.clients]);

  // Get available worker groups from parsed data
  const getAvailableWorkerGroups = useCallback((): string[] => {
    if (!parsedData.workers || !parsedData.workers.headers.includes('WorkerGroup')) {
      return [];
    }

    const groups = parsedData.workers.rows
      .map(row => String(row.WorkerGroup || '').trim())
      .filter(group => group !== '');

    return [...new Set(groups)]; // Remove duplicates
  }, [parsedData.workers]);

  // Handle natural language query results
  const handleQueryResult = useCallback((result: QueryResult) => {
    setQueryResult(result);
    setShowFilteredData(!!result.query);
    
    // If there's a query result, switch to the relevant tab
    if (result.query && result.sheet) {
      setActiveTab(result.sheet);
    }
  }, []);

  // Clear natural language filter
  const handleClearFilter = useCallback(() => {
    setQueryResult(null);
    setShowFilteredData(false);
  }, []);

  // Debug logging
  console.log('ValidationView parsedData state:', {
    hasClients: !!parsedData.clients,
    hasWorkers: !!parsedData.workers,
    hasTasks: !!parsedData.tasks,
    clientsHeaders: parsedData.clients?.headers,
    workersHeaders: parsedData.workers?.headers,
    tasksHeaders: parsedData.tasks?.headers,
    clientsRows: parsedData.clients?.rows?.length,
    workersRows: parsedData.workers?.rows?.length,
    tasksRows: parsedData.tasks?.rows?.length,
  });

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
          ✨ LLM is analyzing your data for optimal column mapping
          </div>
        </div>
      </div>
    );
  }

  // Show parsing summary screen
  if (parsingComplete && parsingSummary) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Files Processed Successfully</h1>
                <p className="text-sm text-gray-600">AI has enhanced your data with intelligent column mapping</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {parsingSummary.aiMappingsApplied.length > 0 && (
                <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium">
                  {parsingSummary.aiMappingsApplied.length === 1
                    ? `1 file enhanced`
                    : `${parsingSummary.aiMappingsApplied.length} files enhanced`
                  } • {parsingSummary.totalMappings} {parsingSummary.totalMappings === 1 ? 'mapping' : 'mappings'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    Processing Complete! 🎉
                  </h2>
                  <p className="text-gray-600">
                    Your files have been successfully processed and are ready for validation.
                  </p>
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{parsingSummary.totalFiles}</div>
                    <div className="text-sm text-gray-600">Files Processed</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{parsingSummary.aiMappingsApplied.length}</div>
                    <div className="text-sm text-gray-600">Files Enhanced by AI</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{parsingSummary.totalMappings}</div>
                    <div className="text-sm text-gray-600">Column Headers Fixed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Mapping Details */}
            {parsingSummary.aiMappingsApplied.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI Column Mapping Results</h3>
                    <p className="text-sm text-gray-600">
                      AI detected and fixed misnamed column headers in{' '}
                      {parsingSummary.aiMappingsApplied.map(file => `${file.file}.csv`).join(', ')}
                      {parsingSummary.aiMappingsApplied.length > 1 ? ' files' : ' file'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {parsingSummary.aiMappingsApplied.map((fileMapping, index) => (
                    <div key={index} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 capitalize">
                              {fileMapping.file}.csv
                            </h4>
                            <p className="text-sm text-gray-600">
                              {(() => {
                                const actualMappings = fileMapping.mappings.filter(mapping => mapping.from !== mapping.to).length;
                                return actualMappings === 1
                                  ? `1 column header fixed`
                                  : actualMappings === 0
                                    ? `No headers needed fixing`
                                    : `${actualMappings} column headers fixed`;
                              })()}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                          {Math.round(fileMapping.confidence * 100)}% confidence
                        </span>
                      </div>

                      <div className="space-y-2">
                        {fileMapping.mappings
                          .filter(mapping => mapping.from !== mapping.to)
                          .map((mapping, mappingIndex) => (
                            <div key={mappingIndex} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-center flex-1">
                                <span className="font-mono bg-red-50 text-red-700 px-3 py-1 rounded border border-red-200 text-sm">
                                  "{mapping.from}"
                                </span>
                                <svg className="w-5 h-5 mx-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span className="font-mono bg-green-50 text-green-700 px-3 py-1 rounded border border-green-200 text-sm">
                                  "{mapping.to}"
                                </span>
                              </div>
                              <span className="text-xs text-blue-600 font-medium ml-3">
                                AI Fixed
                              </span>
                            </div>
                          ))}
                        {fileMapping.mappings.filter(mapping => mapping.from !== mapping.to).length === 0 && (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            No column headers needed fixing - all were already correct!
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Mappings Message */}
            {parsingSummary.aiMappingsApplied.length === 0 && (
              <div className="bg-white border border-green-200 rounded-lg p-6 mb-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Perfect Headers Detected!</h3>
                  <p className="text-gray-600">
                    All your column headers were already correctly formatted. No AI mapping was needed.
                  </p>
                </div>
              </div>
            )}

            {/* Continue Button */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  {parsingSummary.aiMappingsApplied.length > 0
                    ? "These changes have been automatically applied to improve data validation accuracy."
                    : "Your files are ready for validation."
                  }
                </p>
                <button
                  onClick={handleParsingSummaryConfirm}
                  className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                >
                  Continue to Validation
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
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
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPrioritizationDrawer(!showPrioritizationDrawer)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${showPrioritizationDrawer
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              <span>Prioritization</span>
              {prioritizationConfig.presetUsed && (
                <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {prioritizationConfig.presetUsed}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowRuleDrawer(!showRuleDrawer)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${showRuleDrawer
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-white text-purple-600 border border-purple-600 hover:bg-purple-50'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Business Rules</span>
              {businessRules.length > 0 && (
                <span className="bg-white text-purple-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {businessRules.filter(r => r.active).length}
                </span>
              )}
            </button>
            <ExportButton
              parsedData={parsedData}
              businessRules={businessRules}
              prioritizationConfig={prioritizationConfig}
              validationIssues={validationIssues}
              disabled={!parsedData.clients && !parsedData.workers && !parsedData.tasks}
            />
            {/* <button
              onClick={onProceed}
              disabled={validationIssues.some(issue => issue.type === 'error')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${validationIssues.some(issue => issue.type === 'error')
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              Proceed to Analysis
            </button> */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Main Data View */}
        <div className="flex-1 p-6 pt-8 space-y-6 overflow-y-auto">

          {/* Validation Summary */}
          {/* <ValidationSummary 
            issues={validationIssues} 
            onIssueClick={handleIssueClick}
          /> */}

          {/* Natural Language Query */}
          <NaturalLanguageQuery
            parsedData={parsedData}
            onQueryResult={handleQueryResult}
            disabled={loading || !parsedData.clients && !parsedData.workers && !parsedData.tasks}
          />

          {/* Natural Language Data Modification */}
          <NLDataModifier
            data={parsedData[activeTab] || { headers: [], rows: [] }}
            onDataChange={handleDataChange(activeTab)}
            tableName={activeTab}
          />

          {/* Filtered Data View (shown when there's a query result) */}
          {showFilteredData && queryResult && (
            <FilteredDataView
              queryResult={queryResult}
              originalData={parsedData[queryResult.sheet]}
              onClearFilter={handleClearFilter}
            />
          )}

          {/* Regular Data View (hidden when showing filtered results) */}
          {!showFilteredData && (
            <TabbedDataView
              parsedData={parsedData}
              errors={errors}
              onDataChange={handleDataChange}
              onTabChange={setActiveTab}
              highlightedCells={highlightedCells}
              highlightedHeaders={highlightedHeaders}
              hoveredCell={hoveredIssue}
              onHighlightComplete={handleHighlightComplete}
              targetRow={targetRow}
              recentlyUpdatedCells={recentlyUpdatedCells}
            />
          )}
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

      {/* Business Rules Drawer */}
      <Drawer
        open={showRuleDrawer}
        onClose={() => setShowRuleDrawer(false)}
        direction="bottom"
        className="!h-[85vh]"
        style={{ height: '85vh' }}
      >
        <div className="flex flex-col h-full bg-white">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-purple-50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Business Rules</h2>
                <p className="text-sm text-gray-600">Configure validation rules</p>
              </div>
            </div>
            <button
              onClick={() => setShowRuleDrawer(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto">
            <RuleInputUI
              rules={businessRules}
              onRulesChange={handleRulesChange}
              availableTasks={getAvailableTaskIds()}
              availableClientGroups={getAvailableClientGroups()}
              availableWorkerGroups={getAvailableWorkerGroups()}
              prioritizationConfig={prioritizationConfig}
            />
          </div>
        </div>
      </Drawer>

      {/* Prioritization Drawer */}
      <Drawer
        open={showPrioritizationDrawer}
        onClose={() => setShowPrioritizationDrawer(false)}
        direction="bottom"
        className="!h-[85vh]"
        style={{ height: '85vh' }}
      >
        <div className="flex flex-col h-full bg-white">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Prioritization & Weights</h2>
                <p className="text-sm text-gray-600">Configure resource allocation priorities</p>
              </div>
            </div>
            <button
              onClick={() => setShowPrioritizationDrawer(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <PrioritizationWeights
              onConfigChange={handlePrioritizationConfigChange}
              initialConfig={prioritizationConfig}
            />
          </div>
        </div>
      </Drawer>

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

      {/* Toast Container */}
      <ToastContainer
        position="top-center"
        autoClose={8000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={true}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ marginTop: '60px' }} // Add margin to avoid overlap with header
      />
    </div>
  );
}