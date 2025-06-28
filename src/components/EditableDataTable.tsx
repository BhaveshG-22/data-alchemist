'use client';

import { useState, useEffect } from 'react';
import DataTable from 'react-data-table-component';
import { ParsedData } from '@/utils/fileParser';

interface EditableDataTableProps {
  data: ParsedData;
  onDataChange: (newData: ParsedData) => void;
  title: string;
  highlightedCells?: Array<{ row: number; column: string }>;
  onHighlightComplete?: () => void;
}

interface EditableColumn {
  name: string;
  selector: (row: Record<string, unknown>) => string;
  cell: (row: Record<string, unknown>, index: number) => React.ReactElement;
  sortable: boolean;
  width?: string;
}

export default function EditableDataTable({ data, onDataChange, title, highlightedCells = [], onHighlightComplete }: EditableDataTableProps) {
  const [tableData, setTableData] = useState(data.rows);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null);
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTableData(data.rows);
  }, [data]);

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

  const renderEditableCell = (row: Record<string, unknown>, rowIndex: number, column: string) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === column;
    const value = String(row[column] || '');
    const cellKey = `${rowIndex}-${column}`;
    const isFlashing = flashingCells.has(cellKey);

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
        className={`w-full px-2 py-1 cursor-pointer rounded min-h-[32px] flex items-center transition-all duration-300 ${
          isFlashing
            ? 'bg-green-200 border-2 border-green-400 animate-pulse shadow-lg'
            : 'hover:bg-gray-100'
        }`}
        title="Click to edit"
      >
        {value || <span className="text-gray-400">Click to edit</span>}
      </div>
    );
  };

  const columns: EditableColumn[] = data.headers.map(header => ({
    name: header,
    selector: (row: Record<string, unknown>) => String(row[header] || ''),
    cell: (row: Record<string, unknown>) => {
      // Find the actual row index in the data
      const actualRowIndex = tableData.findIndex(dataRow => dataRow === row);
      return renderEditableCell(row, actualRowIndex, header);
    },
    sortable: true,
    width: '150px'
  }));

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
        backgroundColor: '#f1f5f9',
        borderBottom: '1px solid #d1d5db',
      },
    },
    headCells: {
      style: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151',
        paddingLeft: '8px',
        paddingRight: '8px',
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
        <DataTable
          columns={columns}
          data={tableData}
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