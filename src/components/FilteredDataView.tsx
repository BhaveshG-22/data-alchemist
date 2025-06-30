'use client';

import { ParsedData } from '@/utils/fileParser';

interface QueryResult {
  query: string;
  sheet: 'clients' | 'workers' | 'tasks';
  filteredRows: Record<string, unknown>[];
  totalRows: number;
  filterFunction: string;
}

interface FilteredDataViewProps {
  queryResult: QueryResult | null;
  originalData: ParsedData | null;
  onClearFilter: () => void;
}

export default function FilteredDataView({ 
  queryResult, 
  originalData, 
  onClearFilter 
}: FilteredDataViewProps) {
  if (!queryResult || !queryResult.query) {
    return null;
  }

  const hasResults = queryResult.filteredRows.length > 0;
  const resultPercentage = queryResult.totalRows > 0 
    ? Math.round((queryResult.filteredRows.length / queryResult.totalRows) * 100)
    : 0;

  return (
    <div className="bg-background border border-border rounded-lg shadow-sm">
      {/* Results Header */}
      <div className="px-6 py-4 border-b border-border bg-secondary">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Query Results</h3>
              <p className="text-sm text-muted-foreground">
                "{queryResult.query}"
              </p>
            </div>
          </div>
          <button
            onClick={onClearFilter}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Clear Filter
          </button>
        </div>
      </div>

      {/* Results Stats */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 overflow-visible">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Sheet:</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium capitalize">
                {queryResult.sheet}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Results:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                hasResults 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {queryResult.filteredRows.length} of {queryResult.totalRows} rows ({resultPercentage}%)
              </span>
            </div>
          </div>
          
          {/* Generated Filter Function (collapsible) */}
          <div className="relative">
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1">
                <span>View Filter</span>
                <svg className="w-3 h-3 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg p-3 shadow-lg z-50 max-w-md min-w-80">
                <div className="text-xs text-gray-600 mb-1">Generated Filter Function:</div>
                <code className="text-xs bg-gray-100 p-2 rounded block font-mono whitespace-pre-wrap break-all">
                  {queryResult.filterFunction}
                </code>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="p-6">
        {hasResults ? (
          <div className="space-y-4">
            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {originalData?.headers.map((header, index) => (
                      <th
                        key={index}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {queryResult.filteredRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {originalData?.headers.map((header, colIndex) => (
                        <td
                          key={colIndex}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                        >
                          <div className="max-w-xs truncate">
                            {String(row[header] || '').substring(0, 100)}
                            {String(row[header] || '').length > 100 && '...'}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Show more rows indicator if results are truncated */}
            {queryResult.filteredRows.length > 10 && (
              <div className="text-center py-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing first 10 rows of {queryResult.filteredRows.length} results
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-600 mb-4">
              Your query didn't match any rows in the {queryResult.sheet} sheet.
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>Try:</p>
              <ul className="space-y-1">
                <li>• Using different keywords</li>
                <li>• Checking for typos</li>
                <li>• Using broader search terms</li>
                <li>• Trying queries on different sheets</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}