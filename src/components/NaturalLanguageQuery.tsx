'use client';

import { useState, useCallback } from 'react';
import { ParsedData } from '@/utils/fileParser';

interface NaturalLanguageQueryProps {
  parsedData: {
    clients: ParsedData | null;
    workers: ParsedData | null;
    tasks: ParsedData | null;
  };
  onQueryResult: (results: QueryResult) => void;
  disabled?: boolean;
}

interface QueryResult {
  query: string;
  sheet: 'clients' | 'workers' | 'tasks';
  filteredRows: Record<string, unknown>[];
  totalRows: number;
  filterFunction: string;
}

export default function NaturalLanguageQuery({ 
  parsedData, 
  onQueryResult, 
  disabled = false 
}: NaturalLanguageQueryProps) {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse different field types based on column name and data patterns
  const parseFieldValue = useCallback((value: unknown, columnName: string): unknown => {
    if (value === null || value === undefined || value === '') {
      return value;
    }

    const stringValue = String(value);
    const lowerColumnName = columnName.toLowerCase();

    // Duration - convert to number
    if (lowerColumnName.includes('duration')) {
      const num = parseFloat(stringValue);
      return isNaN(num) ? 0 : num;
    }

    // PreferredPhases - parse to array
    if (lowerColumnName.includes('preferred') && lowerColumnName.includes('phase')) {
      try {
        // Handle range format like "1 - 3"
        if (stringValue.includes('-')) {
          const [start, end] = stringValue.split('-').map(s => parseInt(s.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            return Array.from({ length: end - start + 1 }, (_, i) => i + start);
          }
        }
        
        // Handle JSON array format like "[1,2,3]"
        if (stringValue.startsWith('[') && stringValue.endsWith(']')) {
          return JSON.parse(stringValue);
        }
        
        // Handle comma-separated format like "1,2,3"
        if (stringValue.includes(',')) {
          return stringValue.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        }
        
        // Single number
        const num = parseInt(stringValue);
        return isNaN(num) ? [] : [num];
      } catch {
        return [];
      }
    }

    // AvailableSlots, RequiredSkills, Skills - parse to array
    if (lowerColumnName.includes('slot') || lowerColumnName.includes('skill')) {
      try {
        // Handle JSON array format
        if (stringValue.startsWith('[') && stringValue.endsWith(']')) {
          return JSON.parse(stringValue);
        }
        
        // Handle comma-separated format
        if (stringValue.includes(',')) {
          return stringValue.split(',').map(s => s.trim()).filter(s => s !== '');
        }
        
        // Single value
        return [stringValue.trim()];
      } catch {
        return [stringValue];
      }
    }

    // RequestedTaskIDs - parse to array
    if (lowerColumnName.includes('task') && lowerColumnName.includes('id')) {
      try {
        if (stringValue.includes(',')) {
          return stringValue.split(',').map(s => s.trim()).filter(s => s !== '');
        }
        return [stringValue.trim()];
      } catch {
        return [stringValue];
      }
    }

    // Numeric fields
    if (lowerColumnName.includes('priority') || 
        lowerColumnName.includes('level') || 
        lowerColumnName.includes('load') || 
        lowerColumnName.includes('concurrent') ||
        lowerColumnName.includes('max')) {
      const num = parseFloat(stringValue);
      return isNaN(num) ? stringValue : num;
    }

    // Default: return as string
    return stringValue;
  }, []);

  // Determine which sheet to query based on the query content
  const determineTargetSheet = useCallback((query: string): 'clients' | 'workers' | 'tasks' => {
    const lowerQuery = query.toLowerCase();
    
    // Client-related keywords
    if (lowerQuery.includes('client') || lowerQuery.includes('priority') || lowerQuery.includes('group')) {
      return 'clients';
    }
    
    // Worker-related keywords
    if (lowerQuery.includes('worker') || lowerQuery.includes('skill') || lowerQuery.includes('qualification')) {
      return 'workers';
    }
    
    // Task-related keywords
    if (lowerQuery.includes('task') || lowerQuery.includes('duration') || lowerQuery.includes('phase') || lowerQuery.includes('category')) {
      return 'tasks';
    }
    
    // Default to tasks if unclear
    return 'tasks';
  }, []);

  const processNaturalLanguageQuery = useCallback(async (userQuery: string) => {
    setIsProcessing(true);
    setLastQuery(userQuery);

    try {
      // Determine target sheet
      const targetSheet = determineTargetSheet(userQuery);
      const sheetData = parsedData[targetSheet];

      if (!sheetData || !sheetData.rows.length) {
        throw new Error(`No data available for ${targetSheet}`);
      }

      // Create sample data description for the AI
      const sampleRow = sheetData.rows[0];
      const dataSchema = sheetData.headers.map(header => {
        const sampleValue = sampleRow[header];
        return `${header}: ${typeof sampleValue} (example: "${sampleValue}")`;
      }).join('\n');

      // Create AI prompt to generate filter function
      const prompt = `
You are a JavaScript code generator. Convert the user's natural language query into a JavaScript filter function for ${targetSheet} data.

Data Schema for ${targetSheet}:
${dataSchema}

User Query: "${userQuery}"

CRITICAL: Return ONLY the JavaScript expression that evaluates to true/false. The data object is named '${targetSheet.slice(0, -1)}'.

Important field access rules:
- Worker names: ${targetSheet.slice(0, -1)}.WorkerName 
- Client names: ${targetSheet.slice(0, -1)}.ClientName
- Task names: ${targetSheet.slice(0, -1)}.TaskName
- Skills: ${targetSheet.slice(0, -1)}.Skills (array)
- Duration: ${targetSheet.slice(0, -1)}.Duration (number)
- PreferredPhases: ${targetSheet.slice(0, -1)}.PreferredPhases (array)
- Priority: ${targetSheet.slice(0, -1)}.PriorityLevel

String operations:
- Use String(field).toLowerCase() for case-insensitive comparisons
- Use String(field).startsWith() for prefix matching
- Use String(field).includes() for substring matching

Examples:
- "workers whose name starts with A" → "String(${targetSheet.slice(0, -1)}.WorkerName || '').toLowerCase().startsWith('a')"
- "tasks longer than 2 phases" → "${targetSheet.slice(0, -1)}.Duration > 2"
- "workers with JavaScript skills" → "${targetSheet.slice(0, -1)}.Skills && ${targetSheet.slice(0, -1)}.Skills.some(skill => String(skill).toLowerCase().includes('javascript'))"
- "high priority clients" → "${targetSheet.slice(0, -1)}.PriorityLevel && (String(${targetSheet.slice(0, -1)}.PriorityLevel).toLowerCase().includes('high') || Number(${targetSheet.slice(0, -1)}.PriorityLevel) >= 4)"

Return ONLY the JavaScript expression (no 'return' keyword, no function wrapper):`;

      // Call AI service
      const response = await fetch('/api/ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          category: 'natural_language_query',
          context: {
            sheet: targetSheet,
            schema: dataSchema,
            prompt
          }
        })
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const result = await response.json();
      let filterFunctionBody = result.suggestion || '';

      console.log('Raw AI response:', filterFunctionBody);

      // Clean up the response to extract just the function body
      filterFunctionBody = filterFunctionBody
        .replace(/^```javascript\s*/, '')
        .replace(/```$/, '')
        .replace(/^function.*?\{/, '')
        .replace(/\}$/, '')
        .replace(/^return\s+/, '')
        .replace(/^\s*"/, '') // Remove leading quotes
        .replace(/"\s*$/, '') // Remove trailing quotes
        .trim();

      // Remove any markdown formatting or extra text
      const lines = filterFunctionBody.split('\n');
      const codeLines = lines.filter((line: string) => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.startsWith('//') && 
               !trimmed.startsWith('*') &&
               !trimmed.startsWith('Return') &&
               !trimmed.startsWith('Examples') &&
               !trimmed.startsWith('JavaScript') &&
               !trimmed.includes('💡') &&
               !trimmed.includes('**');
      });
      
      if (codeLines.length > 0) {
        filterFunctionBody = codeLines[0].trim();
      }

      // If it doesn't start with return, add it
      if (!filterFunctionBody.startsWith('return')) {
        filterFunctionBody = `return ${filterFunctionBody}`;
      }

      console.log('Cleaned filter function:', filterFunctionBody);

      // Parse the data with field type conversion
      const parsedRows = sheetData.rows.map(row => {
        const parsedRow: Record<string, unknown> = {};
        sheetData.headers.forEach(header => {
          parsedRow[header] = parseFieldValue(row[header], header);
        });
        return parsedRow;
      });

      // Validate the filter function before using it
      let filterFunction;
      try {
        filterFunction = new Function(targetSheet.slice(0, -1), filterFunctionBody);
        
        // Test the function with a sample row to catch syntax errors
        if (parsedRows.length > 0) {
          const testResult = filterFunction(parsedRows[0]);
          console.log('Filter function test result:', testResult);
          
          if (typeof testResult !== 'boolean') {
            console.warn('Filter function should return boolean, got:', typeof testResult);
          }
        }
      } catch (syntaxError) {
        console.error('Filter function syntax error:', syntaxError);
        throw new Error(`Invalid filter function: ${(syntaxError as Error).message}`);
      }

      // Apply filter
      const filteredRows = parsedRows.filter((row, index) => {
        try {
          const result = filterFunction(row);
          
          // Debug log for first few rows
          if (index < 3) {
            console.log(`Row ${index}:`, {
              name: row.WorkerName || row.ClientName || row.TaskName,
              filterResult: result,
              row: row
            });
          }
          
          return Boolean(result);
        } catch (error) {
          console.warn('Filter function error for row:', row, error);
          return false;
        }
      });

      console.log(`Filter applied: ${filteredRows.length} out of ${parsedRows.length} rows matched`);

      // Return results
      const queryResult: QueryResult = {
        query: userQuery,
        sheet: targetSheet,
        filteredRows,
        totalRows: sheetData.rows.length,
        filterFunction: filterFunctionBody
      };

      onQueryResult(queryResult);

    } catch (error) {
      console.error('Natural language query error:', error);
      
      // Try fallback patterns for common queries
      const targetSheet = determineTargetSheet(userQuery);
      const sheetData = parsedData[targetSheet];
      
      if (sheetData && sheetData.rows.length > 0) {
        let fallbackFunction = '';
        let fallbackResults: Record<string, unknown>[] = [];
        
        const lowerQuery = userQuery.toLowerCase();
        
        try {
          // Simple fallback patterns
          if (lowerQuery.includes('name starts with')) {
            const letter = lowerQuery.match(/starts with ([a-z])/)?.[1];
            if (letter) {
              const nameField = targetSheet === 'workers' ? 'WorkerName' : 
                               targetSheet === 'clients' ? 'ClientName' : 'TaskName';
              fallbackFunction = `String(${targetSheet.slice(0, -1)}.${nameField} || '').toLowerCase().startsWith('${letter}')`;
              
              const fallbackFilterFunc = new Function(targetSheet.slice(0, -1), `return ${fallbackFunction}`);
              fallbackResults = sheetData.rows.filter((row, _index) => {
                try {
                  const parsedRow: Record<string, unknown> = {};
                  sheetData.headers.forEach(header => {
                    parsedRow[header] = parseFieldValue(row[header], header);
                  });
                  return fallbackFilterFunc(parsedRow);
                } catch {
                  return false;
                }
              });
            }
          }
        } catch (fallbackError) {
          console.error('Fallback filter also failed:', fallbackError);
        }
        
        onQueryResult({
          query: userQuery,
          sheet: targetSheet,
          filteredRows: fallbackResults,
          totalRows: sheetData.rows.length,
          filterFunction: fallbackFunction || `return false; // Error: ${(error as Error).message}`
        });
      } else {
        // Show empty result on error
        onQueryResult({
          query: userQuery,
          sheet: targetSheet,
          filteredRows: [],
          totalRows: parsedData[targetSheet]?.rows.length || 0,
          filterFunction: `return false; // Error: ${(error as Error).message}`
        });
      }
    } finally {
      setIsProcessing(false);
    }
  }, [parsedData, determineTargetSheet, parseFieldValue, onQueryResult]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isProcessing && !disabled) {
      processNaturalLanguageQuery(query.trim());
    }
  }, [query, isProcessing, disabled, processNaturalLanguageQuery]);

  const handleClear = useCallback(() => {
    setQuery('');
    setLastQuery('');
    // Clear results by sending empty query result
    onQueryResult({
      query: '',
      sheet: 'tasks',
      filteredRows: [],
      totalRows: 0,
      filterFunction: ''
    });
  }, [onQueryResult]);

  // Example queries based on available data
  const exampleQueries = [
    "Show tasks longer than 2 phases",
    "Find all high priority clients", 
    "Workers with JavaScript skills",
    "Tasks that prefer phase 3",
    "Clients in group A",
    "Tasks with duration over 1 phase and prefer phase 2"
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-100 transition-colors duration-150"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="text-left min-w-0 flex-1">
            <h3 className="text-base font-semibold text-gray-900">Natural Language Search</h3>
            <p className="text-sm text-gray-500 mt-0.5">Search your data using plain English queries</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
          {lastQuery && !isExpanded && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full max-w-32 truncate">
              "{lastQuery}"
            </span>
          )}
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Accordion Content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-screen' : 'max-h-0'}`}>
        <div className="px-4 pb-4 border-t border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Show tasks longer than 2 phases that prefer phase 3"
                disabled={disabled || isProcessing}
                className="w-full px-4 py-3 pr-32 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 text-sm"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                {query && (
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
                  disabled={!query.trim() || disabled || isProcessing}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1.5 text-sm font-medium transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Example queries */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Example queries:</label>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setQuery(example)}
                    disabled={disabled || isProcessing}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {lastQuery && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-blue-800">
                  Last query: <span className="font-medium">"{lastQuery}"</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}