import React from 'react';
import { Plus, Minus, Edit, ArrowRight } from 'lucide-react';

interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

interface ModificationDiff {
  operation: 'update' | 'delete' | 'add';
  rowIndex?: number;
  data?: Record<string, unknown>;
  newRow?: Record<string, unknown>;
}

interface DiffVisualizationProps {
  originalData: ParsedData;
  modifications: ModificationDiff[];
  summary: string;
}

export default function DiffVisualization({ originalData, modifications, summary }: DiffVisualizationProps) {
  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'add':
        return <Plus className="h-3 w-3 text-green-600" />;
      case 'delete':
        return <Minus className="h-3 w-3 text-red-600" />;
      case 'update':
        return <Edit className="h-3 w-3 text-blue-600" />;
      default:
        return null;
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'add':
        return 'bg-green-50 border-green-200';
      case 'delete':
        return 'bg-red-50 border-red-200';
      case 'update':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return `[${value.join(', ')}]`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const renderUpdateDiff = (mod: ModificationDiff) => {
    if (!mod.data || typeof mod.rowIndex !== 'number') return null;
    
    const originalRow = originalData.rows[mod.rowIndex];
    const changedFields = Object.keys(mod.data);

    return (
      <div className="space-y-2">
        <div className="text-xs text-gray-600 mb-2">
          Row {mod.rowIndex + 1} - Fields changed: {changedFields.join(', ')}
        </div>
        {changedFields.map(field => (
          <div key={field} className="flex items-center gap-2 text-sm">
            <span className="font-medium w-24 text-gray-700">{field}:</span>
            <div className="flex items-center gap-2 flex-1">
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                {formatValue(originalRow[field])}
              </span>
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                {formatValue(mod.data?.[field])}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDeleteDiff = (mod: ModificationDiff) => {
    if (typeof mod.rowIndex !== 'number') return null;
    
    const row = originalData.rows[mod.rowIndex];
    const displayFields = originalData.headers.slice(0, 3); // Show first 3 fields

    return (
      <div className="space-y-2">
        <div className="text-xs text-gray-600 mb-2">
          Row {mod.rowIndex + 1} will be deleted
        </div>
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
          {displayFields.map(field => (
            <div key={field} className="flex items-center gap-2">
              <span className="font-medium text-gray-700">{field}:</span>
              <span className="text-gray-600">{formatValue(row[field])}</span>
            </div>
          ))}
          {originalData.headers.length > 3 && (
            <div className="text-xs text-gray-500 mt-1">
              ...and {originalData.headers.length - 3} more fields
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAddDiff = (mod: ModificationDiff) => {
    if (!mod.newRow) return null;
    
    const displayFields = Object.keys(mod.newRow).slice(0, 3);

    return (
      <div className="space-y-2">
        <div className="text-xs text-gray-600 mb-2">
          New row will be added
        </div>
        <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
          {displayFields.map(field => (
            <div key={field} className="flex items-center gap-2">
              <span className="font-medium text-gray-700">{field}:</span>
              <span className="text-gray-600">{formatValue(mod.newRow![field])}</span>
            </div>
          ))}
          {Object.keys(mod.newRow).length > 3 && (
            <div className="text-xs text-gray-500 mt-1">
              ...and {Object.keys(mod.newRow).length - 3} more fields
            </div>
          )}
        </div>
      </div>
    );
  };

  const groupedModifications = modifications.reduce((acc, mod) => {
    if (!acc[mod.operation]) acc[mod.operation] = [];
    acc[mod.operation].push(mod);
    return acc;
  }, {} as Record<string, ModificationDiff[]>);

  return (
    <div className="w-full bg-white border-2 border-blue-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Preview Changes</h3>
          <div className="flex gap-1">
            {Object.entries(groupedModifications).map(([operation, mods]) => (
              <div key={operation} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                {getOperationIcon(operation)}
                <span>{mods.length} {operation}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">{summary}</p>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        <div className="space-y-3">
          {modifications.map((mod, index) => (
            <div
              key={index}
              className={`p-3 rounded-md border-2 ${getOperationColor(mod.operation)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getOperationIcon(mod.operation)}
                <span className="font-medium text-sm capitalize">
                  {mod.operation} Operation
                </span>
              </div>
              
              {mod.operation === 'update' && renderUpdateDiff(mod)}
              {mod.operation === 'delete' && renderDeleteDiff(mod)}
              {mod.operation === 'add' && renderAddDiff(mod)}
            </div>
          ))}
        </div>

        {modifications.length > 5 && (
          <div className="text-xs text-gray-500 text-center p-2 bg-gray-50 rounded">
            Showing {modifications.length} modifications. 
            Review carefully before applying changes.
          </div>
        )}
      </div>
    </div>
  );
}