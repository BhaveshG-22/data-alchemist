'use client';

import { useState, useEffect, useMemo } from 'react';
import DataTable from 'react-data-table-component';
import { ParsedData } from '@/utils/fileParser';

interface EditableDataTableProps {
  data: ParsedData;
  onDataChange: (newData: ParsedData) => void;
  title: string;
  highlightedCells?: Array<{ row: number; column: string }>;
  highlightedHeaders?: Array<{ sheet: string; header: string }>;
  hoveredCell?: { row: number; column: string } | null;
  onHighlightComplete?: () => void;
}

interface EditableColumn {
  name: string;
  selector: (row: Record<string, unknown>) => string;
  cell: (row: Record<string, unknown>, index: number) => React.ReactElement;
  sortable: boolean;
  width?: string;
  style?: Record<string, string | number>;
}

export default function EditableDataTable({ data, onDataChange, title, highlightedCells = [], highlightedHeaders = [], hoveredCell, onHighlightComplete }: EditableDataTableProps) {
  const [tableData, setTableData] = useState(data.rows);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());
  const [flashingHeaders, setFlashingHeaders] = useState<Set<string>>(new Set());
  const [headerKey, setHeaderKey] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

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

  const handleHeaderEdit = (oldHeader: string, newHeader: string) => {
    if (oldHeader === newHeader) return;
    
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
  };

  const handleHeaderClick = (header: string) => {
    setEditingHeader(header);
  };

  const handleHeaderBlur = () => {
    setEditingHeader(null);
  };

  const handleSort = (column: string) => {
    if (editingHeader) return; // Don't sort while editing
    
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.column === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ column, direction });
    
    const sortedData = [...tableData].sort((a, b) => {
      const aVal = String(a[column] || '');
      const bVal = String(b[column] || '');
      
      // Try to parse as numbers first
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Fall back to string comparison
      return direction === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    });
    
    setTableData(sortedData);
  };

  const renderEditableHeader = (header: string) => {
    const isEditing = editingHeader === header;
    const isFlashing = flashingHeaders.has(header);
    const isSorted = sortConfig && sortConfig.column === header;
    
    if (isEditing) {
      return (
        <input
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
          className="w-full px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-blue-300 rounded focus:outline-none focus:border-blue-500"
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

  const renderEditableCell = (row: Record<string, unknown>, rowIndex: number, column: string) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === column;
    const value = String(row[column] || '');
    const cellKey = `${rowIndex}-${column}`;
    const isFlashing = flashingCells.has(cellKey);
    const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.column === column;

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
        className={`w-full px-2 py-1 cursor-pointer rounded min-h-[32px] flex items-center transition-all duration-300 border-2 ${
          isFlashing
            ? 'bg-green-200 border-green-400 animate-pulse shadow-lg'
            : isHovered
            ? 'bg-yellow-100 border-yellow-400 shadow-md'
            : 'bg-transparent border-transparent hover:bg-gray-100'
        }`}
        title="Click to edit"
      >
        {value || <span className="text-gray-400">Click to edit</span>}
      </div>
    );
  };

  const columns: EditableColumn[] = useMemo(() => {
    console.log('Creating columns with headers:', data.headers);
    return data.headers.map(header => {
      const isFlashing = flashingHeaders.has(header);
      return {
        name: header,
        selector: (row: Record<string, unknown>) => String(row[header] || ''),
        cell: (row: Record<string, unknown>) => {
          // Find the actual row index in the data
          const actualRowIndex = tableData.findIndex(dataRow => dataRow === row);
          return renderEditableCell(row, actualRowIndex, header);
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

        <DataTable
          columns={columns}
          data={tableData}
          noHeader={true}
          customStyles={customStyles}
          pagination
          paginationPerPage={15}
          paginationRowsPerPageOptions={[10, 15, 25, 50]}
          highlightOnHover
          responsive
          dense
        />
      </div>
      
      {!showHeader && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
          Click on any cell to edit its value. Press Enter to save changes.
        </div>
      )}
    </div>
  );
}