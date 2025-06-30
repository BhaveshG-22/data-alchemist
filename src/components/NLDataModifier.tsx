'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare, Eye, Check, X, Undo2, Redo2, History, Clock, FileText } from 'lucide-react';
import { useDataModificationHistory } from '@/hooks/useDataModificationHistory';
// import DiffVisualization from './DiffVisualization';
// import CommandTemplateSelector from './CommandTemplateSelector';

interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

interface NLDataModifierProps {
  data: ParsedData;
  onDataChange: (newData: ParsedData) => void;
  tableName?: string;
}

interface ModificationPreview {
  modifications: Array<{
    operation: 'update' | 'delete' | 'add';
    rowIndex?: number;
    data?: Record<string, unknown>;
    newRow?: Record<string, unknown>;
  }>;
  summary: string;
  preview: string;
}

export default function NLDataModifier({ data, onDataChange, tableName = 'data' }: NLDataModifierProps) {
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ModificationPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  // const [showTemplates, setShowTemplates] = useState(false);
  
  const {
    addHistoryEntry,
    undo,
    redo,
    canUndo,
    canRedo,
    getHistoryPreview,
    clearHistory,
    totalModifications,
  } = useDataModificationHistory();

  const exampleCommands = [
    "Set all PriorityLevel 2 to 4",
    "Add phase 5 to all tasks where PreferredPhases includes 3",
    "Remove task T012 from all RequestedTaskIDs",
    "Set all clients in GroupB to PriorityLevel 5",
    "Delete all rows where Status is 'inactive'",
    "Update all workers with JavaScript skill to have MaxConcurrentTasks of 3"
  ];

  const handleAnalyzeCommand = async () => {
    if (!command.trim()) {
      setError('Please enter a command');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const response = await fetch('/api/nl-modify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data,
          instruction: command,
          tableName,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to analyze command');
        return;
      }

      setPreview({
        modifications: result.updates.modifications,
        summary: result.updates.summary,
        preview: result.preview,
      });
      setShowPreview(true);

    } catch (err) {
      setError('Failed to process command. Please try again.');
      console.error('NL modify error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyModifications = () => {
    if (!preview) return;

    const originalData = { ...data };
    const newRows = [...data.rows];

    // Sort modifications by rowIndex in descending order for deletions
    const sortedMods = [...preview.modifications].sort((a, b) => {
      if (a.operation === 'delete' && b.operation === 'delete') {
        return (b.rowIndex || 0) - (a.rowIndex || 0);
      }
      return 0;
    });

    for (const mod of sortedMods) {
      switch (mod.operation) {
        case 'update':
          if (typeof mod.rowIndex === 'number' && mod.data) {
            newRows[mod.rowIndex] = { ...newRows[mod.rowIndex], ...mod.data };
          }
          break;
        case 'delete':
          if (typeof mod.rowIndex === 'number') {
            newRows.splice(mod.rowIndex, 1);
          }
          break;
        case 'add':
          if (mod.newRow) {
            newRows.push(mod.newRow);
          }
          break;
      }
    }

    const newData = {
      headers: data.headers,
      rows: newRows,
    };

    // Add to history before applying changes
    addHistoryEntry(
      command,
      tableName,
      originalData,
      newData,
      preview.modifications.length,
      preview.summary
    );

    onDataChange(newData);

    // Reset state and save last command
    setLastCommand(command);
    setCommand('');
    setPreview(null);
    setShowPreview(false);
    setError(null);
  };

  const handleUndo = () => {
    const undoData = undo();
    if (undoData) {
      onDataChange(undoData);
    }
  };

  const handleRedo = () => {
    const redoData = redo();
    if (redoData) {
      onDataChange(redoData);
    }
  };

  const cancelPreview = () => {
    setPreview(null);
    setShowPreview(false);
  };

  return (
    <div className="bg-background border border-border rounded-lg shadow-sm">
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted focus:outline-none focus:bg-muted/50 transition-colors duration-150"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">Natural Language Data Modification</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Modify your data using plain English commands</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
          {lastCommand && !isExpanded && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full max-w-32 truncate">
              "{lastCommand}"
            </span>
          )}
          {totalModifications > 0 && !isExpanded && (
            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
              {totalModifications} changes
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
          <div className="space-y-4 mt-4">
        {/* Command Input and Controls */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., Set all clients with PriorityLevel 2 to 4"
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleAnalyzeCommand()}
              disabled={isLoading || showPreview}
              className="flex-1"
            />
            <Button
              onClick={handleAnalyzeCommand}
              disabled={isLoading || !command.trim() || showPreview}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {isLoading ? 'Analyzing...' : 'Preview'}
            </Button>
          </div>

          {/* Undo/Redo and History Controls */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={!canUndo || isLoading || showPreview}
                className="flex items-center gap-1"
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={!canRedo || isLoading || showPreview}
                className="flex items-center gap-1"
              >
                <Redo2 className="h-3 w-3" />
                Redo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                disabled={isLoading || showPreview}
                className="flex items-center gap-1"
              >
                <History className="h-3 w-3" />
                History
              </Button>
              {/* Temporarily disabled templates button */}
              {/* <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                disabled={isLoading || showPreview}
                className="flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                Templates
              </Button> */}
            </div>
            <div className="text-xs text-gray-500">
              {totalModifications > 0 && `${totalModifications} modifications made`}
            </div>
          </div>
        </div>

        {/* Templates */}
        {/* <CommandTemplateSelector
          data={data}
          onSelectTemplate={(command) => {
            setCommand(command);
            setShowTemplates(false);
          }}
          isVisible={showTemplates}
          onToggle={() => setShowTemplates(!showTemplates)}
        /> */}

        {/* Example Commands */}
        {!showPreview && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Example commands:</p>
            <div className="flex flex-wrap gap-2">
              {exampleCommands.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setCommand(example)}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* History Panel */}
        {showHistory && (
          <Card className="border-2 border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Modification History</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHistory}
                  disabled={totalModifications === 0}
                >
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getHistoryPreview().map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-md border text-sm ${
                      entry.isActive 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 mb-1">
                          "{entry.command}"
                        </div>
                        <div className="text-gray-600 text-xs">
                          {entry.summary}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {entry.timestamp.toLocaleTimeString()}
                          <span>•</span>
                          <span>{entry.modificationsCount} changes</span>
                          <span>•</span>
                          <span>{entry.tableName}</span>
                        </div>
                      </div>
                      {entry.isActive && (
                        <div className="text-xs text-blue-600 font-medium">
                          Current
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {getHistoryPreview().length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No modifications made yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Preview Display */}
        {showPreview && preview && (
          <Card className="border-2 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Preview Changes</CardTitle>
              <p className="text-sm text-gray-600">{preview.summary}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm font-medium mb-2">Changes to be made:</p>
                <pre className="text-xs whitespace-pre-wrap text-gray-700">
                  {preview.preview}
                </pre>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={applyModifications}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Apply Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelPreview}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

            {/* Stats */}
            <div className="text-xs text-gray-500">
              Working with {data.rows.length} rows across {data.headers.length} columns
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}