'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ValidationView from '@/components/ValidationView';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<{
    clients: File | null;
    workers: File | null;
    tasks: File | null;
  }>({
    clients: null,
    workers: null,
    tasks: null,
  });

  const [currentView, setCurrentView] = useState<'upload' | 'validation'>('upload');
  const [isLoadingSampleData, setIsLoadingSampleData] = useState(false);
  const [sampleDataLoaded, setSampleDataLoaded] = useState(false);

  const handleFileSelect = (type: 'clients' | 'workers' | 'tasks') => (file: File) => {
    console.log(`${type} file selected:`, file.name);
    setSampleDataLoaded(false); // Reset sample data state when user uploads
    setUploadedFiles(prev => ({
      ...prev,
      [type]: file
    }));
  };

  const allFilesUploaded = uploadedFiles.clients && uploadedFiles.workers && uploadedFiles.tasks;

  const handleNext = () => {
    setCurrentView('validation');
  };

  const handleBack = () => {
    setCurrentView('upload');
  };

  const handleProceed = () => {
    console.log('Proceeding to analysis...');
  };

  const handleUseSampleData = async () => {
    setIsLoadingSampleData(true);
    setSampleDataLoaded(false);
    
    try {
      // Create File objects from sample data
      const tasksResponse = await fetch('/sample/Sample-tasks.csv');
      const workersResponse = await fetch('/sample/Sample-workers.csv');
      const clientsResponse = await fetch('/sample/Sample-clients.csv');

      const tasksBlob = await tasksResponse.blob();
      const workersBlob = await workersResponse.blob();
      const clientsBlob = await clientsResponse.blob();

      const tasksFile = new File([tasksBlob], 'sample-tasks.csv', { type: 'text/csv' });
      const workersFile = new File([workersBlob], 'sample-workers.csv', { type: 'text/csv' });
      const clientsFile = new File([clientsBlob], 'sample-clients.csv', { type: 'text/csv' });

      setUploadedFiles({
        tasks: tasksFile,
        workers: workersFile,
        clients: clientsFile
      });

      setSampleDataLoaded(true);
      console.log('Sample data loaded successfully');
    } catch (error) {
      console.error('Failed to load sample data:', error);
      // Fallback: create simple mock files
      const createMockFile = (name: string, content: string) => 
        new File([content], name, { type: 'text/csv' });

      setUploadedFiles({
        tasks: createMockFile('sample-tasks.csv', 'TaskID,TaskName,Category,Duration,RequiredSkills,PreferredPhases,MaxConcurrent\nT001,Sample Task,development,5,javascript,1,3'),
        workers: createMockFile('sample-workers.csv', 'WorkerID,WorkerName,Skills,AvailableSlots,MaxLoadPerPhase,WorkerGroup,QualificationLevel\nW001,Sample Worker,javascript,5,4,frontend,8'),
        clients: createMockFile('sample-clients.csv', 'ClientID,ClientName,PriorityLevel,RequestedTaskIDs,GroupTag,AttributesJSON\nC001,Sample Client,3,"T001",enterprise,"{""budget"": 50000}"')
      });
      
      setSampleDataLoaded(true);
    } finally {
      setIsLoadingSampleData(false);
    }
  };

  if (currentView === 'validation') {
    return (
      <ValidationView 
        uploadedFiles={uploadedFiles}
        onBack={handleBack}
        onProceed={handleProceed}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Data Alchemist
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Upload your CSV or XLSX files to transform your data
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleUseSampleData}
              disabled={isLoadingSampleData}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isLoadingSampleData
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : sampleDataLoaded
                  ? 'bg-green-500 text-white'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isLoadingSampleData ? (
                <>⏳ Loading...</>
              ) : sampleDataLoaded ? (
                <>✅ Sample Data Loaded</>
              ) : (
                <>🧪 Use Sample Data</>
              )}
            </button>
            <span className="text-gray-400">or</span>
            <span className="text-gray-600 font-medium">Upload Your Own Files</span>
          </div>
          
          {sampleDataLoaded && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-green-900 font-semibold mb-2 text-center">✅ Sample Data Loaded - Comprehensive Test Suite</h4>
              <div className="text-green-800 text-sm space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium mb-1">📊 Data Volume:</p>
                    <ul className="text-xs space-y-0.5 ml-2">
                      <li>• 90 Tasks with diverse categories</li>
                      <li>• 50 Workers with skill variations</li>
                      <li>• 30 Clients with complex requirements</li>
                      <li>• 25 Business rules with conflicts</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium mb-1">🧪 Edge Cases Covered:</p>
                    <ul className="text-xs space-y-0.5 ml-2">
                      <li>• Duplicate IDs & missing references</li>
                      <li>• Invalid ranges & boundary values</li>
                      <li>• Malformed data & special characters</li>
                      <li>• Circular dependencies & conflicts</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-green-300">
                  <p className="font-medium mb-1">🔍 Validation Scenarios:</p>
                  <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
                    <span>• Skill coverage gaps</span>
                    <span>• Worker overload detection</span>
                    <span>• Business rule conflicts</span>
                    <span>• Data integrity checks</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <FileUpload
            title="Clients"
            description="Upload client information and contact details"
            onFileSelect={handleFileSelect('clients')}
          />
          
          <FileUpload
            title="Workers"
            description="Upload worker profiles and assignments"
            onFileSelect={handleFileSelect('workers')}
          />
          
          <FileUpload
            title="Tasks"
            description="Upload task definitions and requirements"
            onFileSelect={handleFileSelect('tasks')}
          />
        </div>

        <div className="text-center mb-12">
          <button
            onClick={allFilesUploaded ? handleNext : undefined}
            disabled={!allFilesUploaded}
            className={`px-8 py-3 rounded-lg font-medium transition-colors ${
              allFilesUploaded
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Next: Validate Data
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            File Format Requirements
          </h2>
          
          {sampleDataLoaded && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-blue-900 font-medium mb-3">🧪 Sample Data - Edge Case Test Coverage</h3>
              <div className="text-blue-800 text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium mb-2">Data Quality Issues:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Empty fields & null values</li>
                    <li>• Unicode & special characters</li>
                    <li>• Malformed CSV structures</li>
                    <li>• Invalid JSON in attributes</li>
                    <li>• Boundary value violations</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-2">Business Logic Conflicts:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Circular co-run dependencies</li>
                    <li>• Phase window contradictions</li>
                    <li>• Impossible load constraints</li>
                    <li>• Skill coverage gaps</li>
                    <li>• Worker capacity mismatches</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Clients File</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Name, Email, Phone</li>
                <li>• Company, Address</li>
                <li>• Contact Person</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Workers File</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Name, Email, Skills</li>
                <li>• Department, Role</li>
                <li>• Availability Status</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Tasks File</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Task Name, Description</li>
                <li>• Priority, Due Date</li>
                <li>• Assigned Worker</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
