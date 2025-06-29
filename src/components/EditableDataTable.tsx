'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DataTable from 'react-data-table-component';
import { ParsedData } from '@/utils/fileParser';

interface EditableDataTableProps {
  data: ParsedData;
  onDataChange: (newData: ParsedData) => void;
  title: string;
  highlightedCells?: Array<{ row: number; column: string }>;
  highlightedHeaders?: Array<{ sheet: string; header: string }>;
  hoveredCell?: { row: number; column: string; issueType?: 'error' | 'warning' | 'info'; category?: string } | null;
  onHighlightComplete?: () => void;
  targetRow?: number; // Row to navigate to
  recentlyUpdatedCells?: Array<{ sheet: string; row: number; column: string; timestamp: number }>;
}

interface EditableColumn {
  name: string;
  selector: (row: Record<string, unknown>) => string;
  cell: (row: Record<string, unknown>, index: number) => React.ReactElement;
  sortable: boolean;
  width?: string;
  style?: Record<string, string | number>;
}

export default function EditableDataTable({ data, onDataChange, title, highlightedCells = [], highlightedHeaders = [], hoveredCell, onHighlightComplete, targetRow, recentlyUpdatedCells = [] }: EditableDataTableProps) {
  // Debug logging
  console.log('EditableDataTable render:', {
    hasData: !!data,
    headers: data?.headers,
    rowsCount: data?.rows?.length,
    tableDataType: typeof data?.rows,
  });

  const [tableData, setTableData] = useState(data.rows);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());
  const headerInputRef = useRef<HTMLInputElement>(null);
  const [flashingHeaders, setFlashingHeaders] = useState<Set<string>>(new Set());
  const [headerKey, setHeaderKey] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);


  // Navigate to specific row when targetRow changes
  useEffect(() => {
    if (targetRow !== undefined && targetRow >= 0) {
      const targetPage = Math.ceil((targetRow + 1) / rowsPerPage);
      console.log(`🧭 Navigating to page ${targetPage} for row ${targetRow + 1} (rows per page: ${rowsPerPage})`);
      setCurrentPage(targetPage);
    }
  }, [targetRow, rowsPerPage]);

  // Color mapping for different issue types and categories
  const getIssueHoverColors = (issueType?: 'error' | 'warning' | 'info', category?: string) => {
    if (!issueType) return 'bg-yellow-100 border-yellow-400'; // Default yellow

    switch (issueType) {
      case 'error':
        switch (category) {
          case 'missing_columns':
            return 'bg-red-100 border-red-400'; // Red for missing columns
          case 'duplicate_ids':
            return 'bg-pink-100 border-pink-400'; // Pink for duplicates
          case 'malformed_lists':
            return 'bg-orange-100 border-orange-400'; // Orange for malformed data
          case 'out_of_range':
            return 'bg-red-200 border-red-500'; // Darker red for range errors
          case 'json_fields':
            return 'bg-purple-100 border-purple-400'; // Purple for JSON errors
          case 'references':
            return 'bg-indigo-100 border-indigo-400'; // Indigo for reference errors
          default:
            return 'bg-red-100 border-red-400'; // Default red for errors
        }
      case 'warning':
        switch (category) {
          case 'overloaded_workers':
            return 'bg-amber-100 border-amber-400'; // Amber for capacity warnings
          case 'skill_coverage':
            return 'bg-blue-100 border-blue-400'; // Blue for skill issues
          case 'phase_saturation':
            return 'bg-cyan-100 border-cyan-400'; // Cyan for phase issues
          default:
            return 'bg-yellow-100 border-yellow-400'; // Default yellow for warnings
        }
      case 'info':
        switch (category) {
          case 'concurrency_feasibility':
            return 'bg-green-100 border-green-400'; // Green for info about concurrency
          default:
            return 'bg-gray-100 border-gray-400'; // Gray for general info
        }
      default:
        return 'bg-yellow-100 border-yellow-400'; // Fallback
    }
  };

  useEffect(() => {
    console.log('EditableDataTable: Data changed, headers:', data.headers);
    setTableData(data.rows);
    // Force column recreation when headers change
    setHeaderKey(prev => prev + 1);
  }, [data.headers, data.rows]);

  // Handle highlighting when cells are marked for highlight
  useEffect(() => {
    if (highlightedCells.length > 0) {
      const cellKeys = new Set(highlightedCells.map(cell => `${cell.row}-${cell.column}`));
      setFlashingCells(cellKeys);
      
      // Remove highlight after animation
      const timer = setTimeout(() => {
        setFlashingCells(new Set());
        onHighlightComplete?.();
      }, 2000); // 2 second highlight duration
      
      return () => clearTimeout(timer);
    }
  }, [highlightedCells, onHighlightComplete]);

  // Handle highlighting when headers are marked for highlight
  useEffect(() => {
    if (highlightedHeaders.length > 0) {
      const headerKeys = new Set(highlightedHeaders.map(header => header.header));
      setFlashingHeaders(headerKeys);
      
      // Remove highlight after animation
      const timer = setTimeout(() => {
        setFlashingHeaders(new Set());
      }, 2000); // 2 second highlight duration
      
      return () => clearTimeout(timer);
    }
  }, [highlightedHeaders]);

  const handleCellEdit = (rowIndex: number, column: string, value: string) => {
    const newData = [...tableData];
    newData[rowIndex] = { ...newData[rowIndex], [column]: value };
    setTableData(newData);
    
    const updatedData: ParsedData = {
      headers: data.headers,
      rows: newData
    };
    onDataChange(updatedData);
  };

  const handleCellClick = (rowIndex: number, column: string) => {
    setEditingCell({ rowIndex, column });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleHeaderEdit = useCallback((oldHeader: string, newHeader: string) => {
    if (oldHeader === newHeader) {
      setEditingHeader(null);
      return;
    }
    
    // Update headers array
    const newHeaders = data.headers.map(h => h === oldHeader ? newHeader : h);
    
    // Update all row data to use new key
    const newRows = tableData.map(row => {
      const newRow = { ...row };
      if (oldHeader in newRow) {
        newRow[newHeader] = newRow[oldHeader];
        delete newRow[oldHeader];
      }
      return newRow;
    });
    
    const updatedData: ParsedData = {
      headers: newHeaders,
      rows: newRows
    };
    
    onDataChange(updatedData);
    setEditingHeader(null);
  }, [data.headers, tableData, onDataChange]);

  // Handle outside click for header editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingHeader && headerInputRef.current && !headerInputRef.current.contains(event.target as Node)) {
        // Save the current value before closing
        if (headerInputRef.current.value !== editingHeader) {
          handleHeaderEdit(editingHeader, headerInputRef.current.value);
        } else {
          setEditingHeader(null);
        }
      }
    };

    if (editingHeader) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [editingHeader, handleHeaderEdit]);

  const handleHeaderClick = (header: string) => {
    setEditingHeader(header);
  };

  const handleHeaderBlur = () => {
    setEditingHeader(null);
  };

  const handleSort = (column: string) => {
    if (editingHeader) return; // Don't sort while editing
    
    console.log('Sorting by column:', column);
    
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.column === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ column, direction });
    
    const sortedData = [...tableData].sort((a, b) => {
      const aVal = String(a[column] || '');
      const bVal = String(b[column] || '');
    
      // Match pattern like "C1", "W10", "T03"
      const matchA = aVal.match(/^([A-Za-z]+)(\d+)$/);
      const matchB = bVal.match(/^([A-Za-z]+)(\d+)$/);
    
      if (matchA && matchB && matchA[1] === matchB[1]) {
        const numA = parseInt(matchA[2], 10);
        const numB = parseInt(matchB[2], 10);
        return direction === 'asc' ? numA - numB : numB - numA;
      }
    
      // Fallback: normal string compare
      return direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
    
    
    console.log('Sorted data length:', sortedData.length, 'Direction:', direction);
    setTableData(sortedData);
    
    // Also update the parent component with sorted data
    const updatedData: ParsedData = {
      headers: data.headers,
      rows: sortedData
    };
    onDataChange(updatedData);
  };

  const renderEditableHeader = (header: string) => {
    const isEditing = editingHeader === header;
    const isFlashing = flashingHeaders.has(header);
    const isSorted = sortConfig && sortConfig.column === header;
    
    if (isEditing) {
      return (
        <input
          ref={headerInputRef}
          type="text"
          defaultValue={header}
          onBlur={(e) => {
            handleHeaderEdit(header, e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleHeaderEdit(header, e.currentTarget.value);
            } else if (e.key === 'Escape') {
              handleHeaderBlur();
            }
          }}
          autoFocus
          className="w-full px-2 py-2 text-sm font-medium text-gray-700 bg-white border border-blue-300 rounded focus:outline-none focus:border-blue-500"
        />
      );
    }

    return (
      <div
        className={`flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-700 cursor-pointer transition-all duration-300 ${
          isFlashing ? 'animate-pulse bg-green-100' : 'hover:bg-gray-100'
        }`}
      >
        <span 
          onClick={() => handleHeaderClick(header)}
          className="flex-1"
          title="Click to edit header"
        >
          {header}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSort(header);
          }}
          className="ml-1 text-gray-400 hover:text-gray-600"
          title="Click to sort"
        >
          {isSorted ? (
            sortConfig.direction === 'asc' ? '▲' : '▼'
          ) : (
            <span className="opacity-50">▲</span>
          )}
        </button>
      </div>
    );
  };

  const renderEditableCell = useCallback((row: Record<string, unknown>, rowIndex: number, column: string) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === column;
    const value = String(row[column] || '');
    const cellKey = `${rowIndex}-${column}`;
    const isFlashing = flashingCells.has(cellKey);
    const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.column === column;
    const hoverColors = isHovered ? getIssueHoverColors(hoveredCell?.issueType, hoveredCell?.category) : '';
    
    // Check if this cell was recently updated
    const isRecentlyUpdated = recentlyUpdatedCells.some(cell => 
      cell.row === rowIndex && cell.column === column
    );

    if (isEditing) {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => handleCellEdit(rowIndex, column, e.target.value)}
          onBlur={handleCellBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCellBlur();
            }
          }}
          autoFocus
          className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
        />
      );
    }

    return (
      <div
        onClick={() => handleCellClick(rowIndex, column)}
        data-row={rowIndex}
        data-column={column}
        data-cell-id={`cell-${rowIndex}-${column}`}
        className={`w-full px-2 py-1 cursor-pointer rounded min-h-[32px] flex items-center transition-all duration-300 border-2 ${
          isFlashing
            ? 'bg-green-200 border-green-400 animate-pulse shadow-lg'
            : isRecentlyUpdated
            ? 'bg-green-100 border-green-300 shadow-md'
            : isHovered
            ? `${hoverColors} shadow-md`
            : 'bg-transparent border-transparent hover:bg-gray-100'
        }`}
        title={isRecentlyUpdated ? "Recently updated by AI" : "Click to edit"}
      >
        {value || <span className="text-gray-400">Click to edit</span>}
      </div>
    );
  }, [editingCell, flashingCells, hoveredCell, recentlyUpdatedCells, handleCellClick, handleCellEdit, handleCellBlur]);


  const columns: EditableColumn[] = useMemo(() => {
    console.log('Creating columns with headers:', data.headers);
    if (!data.headers || data.headers.length === 0) {
      console.error('No headers found in data:', data);
      return [];
    }
    return data.headers.map(header => {
      const isFlashing = flashingHeaders.has(header);
      return {
        name: header,
        selector: (row: Record<string, unknown>) => String(row[header] || ''),
        cell: (row: Record<string, unknown>, index?: number) => {
          try {
            // Find the original row index in the initial data (before any sorting/filtering)
            const originalRowIndex = data.rows.findIndex(dataRow => dataRow === row);
            const displayRowIndex = originalRowIndex !== -1 ? originalRowIndex : (index !== undefined ? index : tableData.findIndex(dataRow => dataRow === row));
            
            return renderEditableCell(row, displayRowIndex, header);
          } catch (error) {
            console.error('Error rendering cell:', error, { row, header, index });
            return <div className="text-red-500 text-xs">Error</div>;
          }
        },
        sortable: true,
        width: '150px',
        style: isFlashing ? {
          backgroundColor: '#bbf7d0',
          animation: 'pulse 1s infinite',
          transition: 'all 0.3s ease'
        } : undefined
      };
    });
  }, [data.headers, tableData, flashingHeaders, renderEditableCell]);

  const customStyles = {
    header: {
      style: {
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '16px',
        fontWeight: '600',
        color: '#374151',
      },
    },
    headRow: {
      style: {
        display: 'none', // Hide the DataTable header row completely
      },
    },
    headCells: {
      style: {
        display: 'none', // Hide individual header cells
      },
    },
    rows: {
      style: {
        borderBottom: '1px solid #f1f5f9',
        '&:hover': {
          backgroundColor: '#f8fafc',
        },
      },
    },
    cells: {
      style: {
        paddingLeft: '4px',
        paddingRight: '4px',
      },
    },
  };

  const showHeader = title && title.trim() !== '';

  // Safety check for data
  if (!data || !data.headers || !Array.isArray(data.headers) || data.headers.length === 0) {
    console.error('Invalid data passed to EditableDataTable:', data);
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Invalid Data</h3>
          <p className="text-gray-500">No valid data or headers found to display.</p>
          <div className="mt-4 text-xs text-gray-400">
            Debug: {JSON.stringify({ hasData: !!data, headers: data?.headers, rowsLength: data?.rows?.length })}
          </div>
        </div>
      </div>
    );
  }

  if (!data.rows || !Array.isArray(data.rows)) {
    console.error('Invalid rows data:', data.rows);
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <div className="text-center">
          <div className="text-yellow-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Rows</h3>
          <p className="text-gray-500">Headers found but no data rows to display.</p>
          <div className="mt-2 text-sm text-gray-600">
            Headers: {data.headers.join(', ')}
          </div>
        </div>
      </div>
    );
  }

  console.log('Rendering EditableDataTable with:', {
    headerCount: data.headers.length,
    rowCount: data.rows.length,
    columnsCount: columns.length
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <div className="text-sm text-gray-500">
              {tableData.length} rows × {data.headers.length} columns
            </div>
          </div>
        </div>
      )}
      
      <div className="overflow-hidden">
        {/* Custom Editable Header Row */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex">
            {data.headers.map((header, index) => (
              <div
                key={`${header}-${index}`}
                className="flex-shrink-0 border-r border-gray-200 last:border-r-0"
                style={{ width: '150px' }}
              >
                {renderEditableHeader(header)}
              </div>
            ))}
          </div>
        </div>

        {columns.length > 0 && tableData.length > 0 ? (
          <DataTable
            key={`datatable-${currentPage}-${rowsPerPage}-${targetRow || 0}`}
            columns={columns}
            data={tableData}
            noHeader={true}
            customStyles={customStyles}
            pagination
            paginationPerPage={rowsPerPage}
            paginationRowsPerPageOptions={[25, 50, 100, 150]}
            paginationDefaultPage={currentPage}
            paginationServer={false}
            onChangePage={setCurrentPage}
            onChangeRowsPerPage={(newRowsPerPage) => {
              setRowsPerPage(newRowsPerPage);
              setCurrentPage(1); // Reset to first page when changing rows per page
            }}
            highlightOnHover
            responsive
            dense
          />
        ) : (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              {columns.length === 0 ? 'No columns configured' : 'No rows to display'}
            </p>
            <div className="mt-2 text-xs text-gray-400">
              Columns: {columns.length}, Rows: {tableData.length}
            </div>
          </div>
        )}
      </div>
      
      {!showHeader && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
          Click on any cell to edit its value. Press Enter to save changes.
        </div>
      )}
    </div>
  );
}