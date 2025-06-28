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

  const handleFileSelect = (type: 'clients' | 'workers' | 'tasks') => (file: File) => {
    console.log(`${type} file selected:`, file.name);
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
          <p className="text-lg text-gray-600">
            Upload your CSV or XLSX files to transform your data
          </p>
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
