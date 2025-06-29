import { useState, useCallback, useRef } from 'react';

interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

interface ModificationHistoryEntry {
  id: string;
  timestamp: Date;
  command: string;
  tableName: string;
  beforeData: ParsedData;
  afterData: ParsedData;
  modificationsCount: number;
  summary: string;
}

export function useDataModificationHistory(maxHistorySize: number = 50) {
  const [history, setHistory] = useState<ModificationHistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const entryIdCounter = useRef(0);

  const addHistoryEntry = useCallback((
    command: string,
    tableName: string,
    beforeData: ParsedData,
    afterData: ParsedData,
    modificationsCount: number,
    summary: string
  ) => {
    const entry: ModificationHistoryEntry = {
      id: `mod_${++entryIdCounter.current}`,
      timestamp: new Date(),
      command,
      tableName,
      beforeData: JSON.parse(JSON.stringify(beforeData)), // Deep clone
      afterData: JSON.parse(JSON.stringify(afterData)), // Deep clone
      modificationsCount,
      summary,
    };

    setHistory(prev => {
      // Remove any entries after current index (when undoing and then making new changes)
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(entry);
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      }
      
      return newHistory;
    });

    setCurrentIndex(prev => {
      const newIndex = Math.min(prev + 1, maxHistorySize - 1);
      return newIndex;
    });
  }, [currentIndex, maxHistorySize]);

  const undo = useCallback((): ParsedData | null => {
    if (currentIndex >= 0) {
      const entry = history[currentIndex];
      setCurrentIndex(prev => prev - 1);
      return entry.beforeData;
    }
    return null;
  }, [history, currentIndex]);

  const redo = useCallback((): ParsedData | null => {
    if (currentIndex < history.length - 1) {
      const entry = history[currentIndex + 1];
      setCurrentIndex(prev => prev + 1);
      return entry.afterData;
    }
    return null;
  }, [history, currentIndex]);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;

  const getCurrentEntry = useCallback((): ModificationHistoryEntry | null => {
    if (currentIndex >= 0 && currentIndex < history.length) {
      return history[currentIndex];
    }
    return null;
  }, [history, currentIndex]);

  const getHistoryPreview = useCallback((maxEntries: number = 10) => {
    return history
      .slice(-maxEntries)
      .reverse()
      .map((entry, index) => ({
        ...entry,
        isActive: history.length - 1 - index === currentIndex,
      }));
  }, [history, currentIndex]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  const jumpToHistoryEntry = useCallback((entryId: string): ParsedData | null => {
    const entryIndex = history.findIndex(entry => entry.id === entryId);
    if (entryIndex !== -1) {
      setCurrentIndex(entryIndex);
      return history[entryIndex].afterData;
    }
    return null;
  }, [history]);

  return {
    // History management
    addHistoryEntry,
    clearHistory,
    
    // Undo/Redo operations
    undo,
    redo,
    canUndo,
    canRedo,
    
    // History inspection
    history,
    currentIndex,
    getCurrentEntry,
    getHistoryPreview,
    jumpToHistoryEntry,
    
    // Statistics
    totalModifications: history.reduce((sum, entry) => sum + entry.modificationsCount, 0),
    historySize: history.length,
  };
}