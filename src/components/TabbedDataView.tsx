'use client';

import { useState } from 'react';
import EditableDataTable from './EditableDataTable';
import { ParsedData } from '@/utils/fileParser';

interface TabbedDataViewProps {
  parsedData: {
    clients: ParsedData | null;
    workers: ParsedData | null;
    tasks: ParsedData | null;
  };
  errors: {
    clients: string | null;
    workers: string | null;
    tasks: string | null;
  };
  onDataChange: (type: 'clients' | 'workers' | 'tasks') => (newData: ParsedData) => void;
  onTabChange?: (tab: 'clients' | 'workers' | 'tasks') => void;
  highlightedCells?: Array<{ row: number; column: string }>;
  highlightedHeaders?: Array<{ sheet: string; header: string }>;
  hoveredCell?: { row: number; column: string } | null;
  onHighlightComplete?: () => void;
}

export default function TabbedDataView({ parsedData, errors, onDataChange, onTabChange, highlightedCells, highlightedHeaders, hoveredCell, onHighlightComplete }: TabbedDataViewProps) {
  const [activeTab, setActiveTab] = useState<'clients' | 'workers' | 'tasks'>('clients');

  const handleTabChange = (tab: 'clients' | 'workers' | 'tasks') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const tabs = [
    { 
      id: 'clients' as const, 
      label: 'Clients', 
      data: parsedData.clients, 
      error: errors.clients 
    },
    { 
      id: 'workers' as const, 
      label: 'Workers', 
      data: parsedData.workers, 
      error: errors.workers 
    },
    { 
      id: 'tasks' as const, 
      label: 'Tasks', 
      data: parsedData.tasks, 
      error: errors.tasks 
    }
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex space-x-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center space-x-2">
                <span>{tab.label}</span>
                {tab.data && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full">
                    {tab.data.rows.length}
                  </span>
                )}
                {tab.error && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                    !
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTabData?.error ? (
          <div className="p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center mb-2">
                <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-800">Error parsing {activeTabData.label.toLowerCase()} file</h3>
              </div>
              <p className="text-red-700">{activeTabData.error}</p>
            </div>
          </div>
        ) : activeTabData?.data ? (
          <div className="p-0">
            <EditableDataTable
              key={`${activeTab}-${activeTabData.data.headers.join(',')}`}
              data={activeTabData.data}
              onDataChange={onDataChange(activeTab)}
              title=""
              highlightedCells={highlightedCells}
              highlightedHeaders={highlightedHeaders?.filter(h => h.sheet === activeTab)}
              hoveredCell={hoveredCell}
              onHighlightComplete={onHighlightComplete}
            />
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No {activeTabData?.label.toLowerCase()} file uploaded</h3>
            <p className="text-gray-500">Upload a {activeTabData?.label.toLowerCase()} file to view and edit the data here.</p>
          </div>
        )}
      </div>

      {/* Footer with file info */}
      {activeTabData?.data && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{activeTabData.data.rows.length} rows × {activeTabData.data.headers.length} columns</span>
            <span>Click on any cell to edit • Press Enter to save</span>
          </div>
        </div>
      )}
    </div>
  );
}