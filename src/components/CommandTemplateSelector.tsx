import React, { useState } from 'react';
import { FileText, Search, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useCommandTemplates } from '@/hooks/useCommandTemplates';

interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

interface CommandTemplateSelectorProps {
  data: ParsedData;
  onSelectTemplate: (command: string) => void;
  isVisible: boolean;
  onToggle: () => void;
}

export default function CommandTemplateSelector({ 
  data, 
  onSelectTemplate, 
  isVisible, 
  onToggle 
}: CommandTemplateSelectorProps) {
  const {
    filteredTemplates,
    getTemplatesByCategory,
    smartSuggestions,
    searchTerm,
    setSearchTerm,
    categories,
    fillTemplate,
    getSuggestedValues
  } = useCommandTemplates(data);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const displayTemplates = selectedCategory === 'all' 
    ? filteredTemplates 
    : getTemplatesByCategory(selectedCategory);

  const getCategoryColor = (category: string) => {
    const colors = {
      filter: 'bg-blue-50 text-blue-700 border-blue-200',
      update: 'bg-green-50 text-green-700 border-green-200',
      delete: 'bg-red-50 text-red-700 border-red-200',
      add: 'bg-purple-50 text-purple-700 border-purple-200',
      transform: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const handleTemplateSelect = (template: any) => {
    if (template.variables && template.variables.length > 0) {
      setExpandedTemplate(expandedTemplate === template.id ? null : template.id);
    } else {
      onSelectTemplate(template.command);
    }
  };

  const handleTemplateWithVariables = (template: any, variables: Record<string, string>) => {
    const filledCommand = fillTemplate(template, variables);
    onSelectTemplate(filledCommand);
    setExpandedTemplate(null);
  };

  if (!isVisible) return null;

  return (
    <div className="w-full bg-white border-2 border-purple-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Command Templates</h3>
          </div>
          <button
            onClick={onToggle}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Smart Suggestions */}
        {smartSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium text-purple-700">
              <Sparkles className="h-3 w-3" />
              Smart Suggestions for Your Data
            </div>
            <div className="grid gap-2">
              {smartSuggestions.slice(0, 3).map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="text-left p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-xs">{template.name}</div>
                  <div className="text-xs text-gray-600">{template.command}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
              selectedCategory === 'all' 
                ? 'bg-blue-500 text-white border-blue-500' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors capitalize ${
                selectedCategory === category 
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Templates */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {displayTemplates.map((template) => (
            <div key={template.id} className="space-y-2">
              <div
                className={`p-3 rounded-md border cursor-pointer transition-colors hover:bg-gray-50 ${getCategoryColor(template.category)}`}
                onClick={() => handleTemplateSelect(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{template.description}</div>
                    <div className="text-xs font-mono mt-2 p-1 bg-white/50 rounded">
                      {template.command}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs px-2 py-1 bg-white/70 rounded capitalize">
                      {template.category}
                    </span>
                    {template.variables && template.variables.length > 0 && (
                      <ChevronDown className={`h-3 w-3 transition-transform ${
                        expandedTemplate === template.id ? 'rotate-180' : ''
                      }`} />
                    )}
                  </div>
                </div>
              </div>

              {/* Variable Input Form */}
              {expandedTemplate === template.id && template.variables && (
                <VariableInputForm
                  template={template}
                  onSubmit={(variables) => handleTemplateWithVariables(template, variables)}
                  onCancel={() => setExpandedTemplate(null)}
                  getSuggestedValues={getSuggestedValues}
                />
              )}
            </div>
          ))}

          {displayTemplates.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No templates found matching your search
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Variable Input Form Component
function VariableInputForm({ 
  template, 
  onSubmit, 
  onCancel, 
  getSuggestedValues 
}: {
  template: any;
  onSubmit: (variables: Record<string, string>) => void;
  onCancel: () => void;
  getSuggestedValues: (variable: string) => string[];
}) {
  const [variables, setVariables] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(variables);
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg">
      <div className="p-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="text-sm font-medium">Customize Template Variables:</div>
          
          {template.variables.map((variable: string) => {
            const suggestions = getSuggestedValues(variable);
            return (
              <div key={variable}>
                <label className="text-xs font-medium text-gray-700 capitalize">
                  {variable.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                </label>
                <input
                  type="text"
                  value={variables[variable] || ''}
                  onChange={(e) => setVariables(prev => ({
                    ...prev,
                    [variable]: e.target.value
                  }))}
                  placeholder={`Enter ${variable}`}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {suggestions.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {suggestions.slice(0, 4).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setVariables(prev => ({
                          ...prev,
                          [variable]: suggestion
                        }))}
                        className="text-xs px-2 py-1 h-6 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          <div className="flex gap-2 pt-2">
            <button 
              type="submit" 
              className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Use Template
            </button>
            <button 
              type="button" 
              onClick={onCancel}
              className="px-3 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}