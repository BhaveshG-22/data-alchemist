'use client';

import { useState, useEffect } from 'react';
import TabbedDataView from './TabbedDataView';
import IssuesSidebar, { ValidationIssue } from './IssuesSidebar';
import { parseFile, ParsedData } from '@/utils/fileParser';

interface ValidationViewProps {
  uploadedFiles: {
    clients: File | null;
    workers: File | null;
    tasks: File | null;
  };
  onBack: () => void;
  onProceed: () => void;
}

export default function ValidationView({ uploadedFiles, onBack, onProceed }: ValidationViewProps) {
  const [parsedData, setParsedData] = useState<{
    clients: ParsedData | null;
    workers: ParsedData | null;
    tasks: ParsedData | null;
  }>({
    clients: null,
    workers: null,
    tasks: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{
    clients: string | null;
    workers: string | null;
    tasks: string | null;
  }>({
    clients: null,
    workers: null,
    tasks: null,
  });
  
  const [activeTab, setActiveTab] = useState<'clients' | 'workers' | 'tasks'>('clients');
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  // Required headers for each sheet type
  const requiredHeaders = {
    clients: ['ClientID', 'ClientName', 'PriorityLevel', 'RequestedTaskIDs', 'GroupTag', 'AttributesJSO'],
    workers: ['WorkerID', 'WorkerName', 'Skills', 'AvailableSlots', 'MaxLoadPerPhase', 'WorkerGroup', 'QualificationLevel'],
    tasks: ['TaskID', 'TaskName', 'Category', 'Duration', 'RequiredSkills', 'PreferredPhases', 'MaxConcurrent']
  };

  const validateData = (data: ParsedData, type: 'clients' | 'workers' | 'tasks'): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const required = requiredHeaders[type];
    
    // Check for missing required headers
    const missingHeaders = required.filter(header => !data.headers.includes(header));
    missingHeaders.forEach(header => {
      issues.push({
        type: 'error',
        category: 'header',
        message: `Missing required header: ${header}`,
        sheet: type,
        severity: 'high'
      });
    });

    // Check for extra headers
    const extraHeaders = data.headers.filter(header => !required.includes(header));
    extraHeaders.forEach(header => {
      issues.push({
        type: 'warning',
        category: 'header',
        message: `Unexpected header: ${header}`,
        sheet: type,
        severity: 'low'
      });
    });

    // Validate data types and formats
    data.rows.forEach((row, rowIndex) => {
      if (type === 'clients') {
        // Validate PriorityLevel (integer 1-5)
        const priority = row['PriorityLevel'];
        if (priority && (isNaN(Number(priority)) || Number(priority) < 1 || Number(priority) > 5)) {
          issues.push({
            type: 'error',
            category: 'data',
            message: `PriorityLevel must be integer 1-5, got: ${priority}`,
            sheet: type,
            row: rowIndex,
            column: 'PriorityLevel',
            severity: 'high'
          });
        }

        // Validate AttributesJSON
        const attributesJSON = row['AttributesJSON'];
        if (attributesJSON && attributesJSON.trim() !== '') {
          try {
            JSON.parse(attributesJSON);
          } catch {
            issues.push({
              type: 'error',
              category: 'format',
              message: `Invalid JSON format in AttributesJSON`,
              sheet: type,
              row: rowIndex,
              column: 'AttributesJSON',
              severity: 'high'
            });
          }
        }
      }

      if (type === 'workers') {
        // Validate MaxLoadPerPhase (integer)
        const maxLoad = row['MaxLoadPerPhase'];
        if (maxLoad && isNaN(Number(maxLoad))) {
          issues.push({
            type: 'error',
            category: 'data',
            message: `MaxLoadPerPhase must be integer, got: ${maxLoad}`,
            sheet: type,
            row: rowIndex,
            column: 'MaxLoadPerPhase',
            severity: 'high'
          });
        }

        // Validate AvailableSlots (array format)
        const availableSlots = row['AvailableSlots'];
        if (availableSlots && availableSlots.trim() !== '') {
          try {
            const parsed = JSON.parse(availableSlots);
            if (!Array.isArray(parsed) || !parsed.every(slot => Number.isInteger(slot))) {
              throw new Error('Invalid format');
            }
          } catch {
            issues.push({
              type: 'error',
              category: 'format',
              message: `AvailableSlots must be array of integers (e.g. [1,3,5])`,
              sheet: type,
              row: rowIndex,
              column: 'AvailableSlots',
              severity: 'high'
            });
          }
        }
      }

      if (type === 'tasks') {
        // Validate Duration (number ≥1)
        const duration = row['Duration'];
        if (duration && (isNaN(Number(duration)) || Number(duration) < 1)) {
          issues.push({
            type: 'error',
            category: 'data',
            message: `Duration must be number ≥1, got: ${duration}`,
            sheet: type,
            row: rowIndex,
            column: 'Duration',
            severity: 'high'
          });
        }

        // Validate MaxConcurrent (integer)
        const maxConcurrent = row['MaxConcurrent'];
        if (maxConcurrent && isNaN(Number(maxConcurrent))) {
          issues.push({
            type: 'error',
            category: 'data',
            message: `MaxConcurrent must be integer, got: ${maxConcurrent}`,
            sheet: type,
            row: rowIndex,
            column: 'MaxConcurrent',
            severity: 'high'
          });
        }
      }

      // Check for empty required fields
      required.forEach(header => {
        if (data.headers.includes(header)) {
          const value = row[header];
          if (!value || value.toString().trim() === '') {
            issues.push({
              type: 'error',
              category: 'missing',
              message: `Empty required field`,
              sheet: type,
              row: rowIndex,
              column: header,
              severity: 'high'
            });
          }
        }
      });
    });

    return issues;
  };

  useEffect(() => {
    const parseFiles = async () => {
      setLoading(true);
      const newParsedData: {
        clients: ParsedData | null;
        workers: ParsedData | null;
        tasks: ParsedData | null;
      } = { clients: null, workers: null, tasks: null };
      
      const newErrors: {
        clients: string | null;
        workers: string | null;
        tasks: string | null;
      } = { clients: null, workers: null, tasks: null };

      // Parse clients file
      if (uploadedFiles.clients) {
        try {
          newParsedData.clients = await parseFile(uploadedFiles.clients);
        } catch (error) {
          newErrors.clients = (error as Error).message;
        }
      }

      // Parse workers file
      if (uploadedFiles.workers) {
        try {
          newParsedData.workers = await parseFile(uploadedFiles.workers);
        } catch (error) {
          newErrors.workers = (error as Error).message;
        }
      }

      // Parse tasks file
      if (uploadedFiles.tasks) {
        try {
          newParsedData.tasks = await parseFile(uploadedFiles.tasks);
        } catch (error) {
          newErrors.tasks = (error as Error).message;
        }
      }

      // Validate data and collect issues
      const allIssues: ValidationIssue[] = [];
      if (newParsedData.clients) {
        allIssues.push(...validateData(newParsedData.clients, 'clients'));
      }
      if (newParsedData.workers) {
        allIssues.push(...validateData(newParsedData.workers, 'workers'));
      }
      if (newParsedData.tasks) {
        allIssues.push(...validateData(newParsedData.tasks, 'tasks'));
      }

      setParsedData(newParsedData);
      setErrors(newErrors);
      setValidationIssues(allIssues);
      setLoading(false);
    };

    parseFiles();
  }, [uploadedFiles]);

  const handleDataChange = (type: 'clients' | 'workers' | 'tasks') => (newData: ParsedData) => {
    setParsedData(prev => ({
      ...prev,
      [type]: newData
    }));
  };

  const handleIssueClick = (issue: ValidationIssue) => {
    // Handle clicking on an issue in the sidebar
    console.log('Issue clicked:', issue);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Parsing uploaded files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Upload
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Data Validation</h1>
              <p className="text-sm text-gray-600">Review and validate your uploaded data files</p>
            </div>
          </div>
          <button 
            onClick={onProceed}
            disabled={validationIssues.some(issue => issue.type === 'error')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              validationIssues.some(issue => issue.type === 'error')
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Proceed to Analysis
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Data View */}
        <div className="flex-1 p-6">
          <TabbedDataView
            parsedData={parsedData}
            errors={errors}
            onDataChange={handleDataChange}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Issues Sidebar */}
        <IssuesSidebar
          issues={validationIssues}
          parsedData={parsedData}
          activeTab={activeTab}
          onIssueClick={handleIssueClick}
        />
      </div>
    </div>
  );
}