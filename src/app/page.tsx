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
      const tasksResponse = await fetch('/test-data/tasks.csv');
      const workersResponse = await fetch('/test-data/workers.csv');
      const clientsResponse = await fetch('/test-data/clients.csv');

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
              <p className="text-green-800 text-sm text-center">
                <strong>Sample data loaded!</strong> This comprehensive dataset includes validation test cases with edge cases and conflicts.
              </p>
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
              <h3 className="text-blue-900 font-medium mb-2">🧪 Sample Data Information</h3>
              <p className="text-blue-800 text-sm">
                The loaded sample data contains <strong>comprehensive test cases</strong> including:
                duplicate IDs, invalid ranges, missing skills, conflicting business rules, 
                and circular dependencies. Perfect for testing all validation scenarios!
              </p>
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
