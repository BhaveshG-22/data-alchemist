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
  hoveredCell?: { row: number; column: string; issueType?: 'error' | 'warning' | 'info'; category?: string } | null;
  onHighlightComplete?: () => void;
  targetRow?: number;
  recentlyUpdatedCells?: Array<{ sheet: string; row: number; column: string; timestamp: number }>;
}

export default function TabbedDataView({ parsedData, errors, onDataChange, onTabChange, highlightedCells, highlightedHeaders, hoveredCell, onHighlightComplete, targetRow, recentlyUpdatedCells }: TabbedDataViewProps) {
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
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-border bg-secondary">
        <div className="flex space-x-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === tab.id
                  ? 'text-primary border-primary bg-card'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
              }`}
            >
              <span className="flex items-center space-x-2">
                <span>{tab.label}</span>
                {tab.data && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-primary-foreground bg-primary rounded-full">
                    {tab.data.rows.length}
                  </span>
                )}
                {tab.error && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-destructive-foreground bg-destructive rounded-full">
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
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6">
              <div className="flex items-center mb-2">
                <svg className="w-6 h-6 text-destructive mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-destructive">Error parsing {activeTabData.label.toLowerCase()} file</h3>
              </div>
              <p className="text-destructive">{activeTabData.error}</p>
            </div>
          </div>
        ) : activeTabData?.data ? (
          <div className="space-y-4">
            {/* Data Table */}
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
                targetRow={targetRow}
                recentlyUpdatedCells={recentlyUpdatedCells?.filter(cell => cell.sheet === activeTab)}
              />
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="text-muted-foreground mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No {activeTabData?.label.toLowerCase()} file uploaded</h3>
            <p className="text-muted-foreground">Upload a {activeTabData?.label.toLowerCase()} file to view and edit the data here.</p>
          </div>
        )}
      </div>

      {/* Footer with file info */}
      {activeTabData?.data && (
        <div className="border-t border-border bg-secondary px-6 py-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{activeTabData.data.rows.length} rows × {activeTabData.data.headers.length} columns</span>
            <div className="flex items-center space-x-4">
              <span>Click on any cell to edit • Press Enter to save</span>
              <div className="flex items-center space-x-2 text-xs">
                <span>Hover colors:</span>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-destructive/20 border border-destructive rounded"></div>
                  <span>Errors</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-accent/20 border border-accent rounded"></div>
                  <span>Warnings</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-muted border border-border rounded"></div>
                  <span>Info</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}