'use client';

import React, { useState, useEffect } from 'react';
import { 
  PRIORITIZATION_CRITERIA, 
  PRESET_PROFILES, 
  DEFAULT_PRIORITIZATION_CONFIG,
  PrioritizationConfig,
  PrioritizationCriterion
} from '@/config/prioritizationCriteria';

interface PrioritizationWeightsProps {
  onConfigChange: (config: PrioritizationConfig) => void;
  initialConfig?: PrioritizationConfig;
}

export default function PrioritizationWeights({ 
  onConfigChange, 
  initialConfig = DEFAULT_PRIORITIZATION_CONFIG 
}: PrioritizationWeightsProps) {
  const [config, setConfig] = useState<PrioritizationConfig>(initialConfig);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  // Update parent component when config changes
  useEffect(() => {
    onConfigChange(config);
  }, [config, onConfigChange]);

  // Handle weight changes from sliders
  const handleWeightChange = (criterionId: string, value: number) => {
    const newWeights = {
      ...config.weights,
      [criterionId]: value
    };
    
    setConfig(prev => ({
      ...prev,
      weights: newWeights,
      method: 'slider',
      presetUsed: undefined // Clear preset when manually adjusting
    }));
    
    setSelectedProfile(''); // Clear selected profile
  };

  // Handle preset profile selection
  const handlePresetChange = (profileId: string) => {
    if (profileId === '') {
      setSelectedProfile('');
      return;
    }

    const profile = PRESET_PROFILES.find(p => p.id === profileId);
    if (profile) {
      setConfig(prev => ({
        ...prev,
        method: 'preset',
        weights: profile.weights,
        presetUsed: profileId
      }));
      setSelectedProfile(profileId);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setConfig(DEFAULT_PRIORITIZATION_CONFIG);
    setSelectedProfile('');
  };

  // Calculate total weight
  const totalWeight = Object.values(config.weights).reduce((sum, weight) => sum + weight, 0);

  // Get criterion by ID
  const getCriterion = (id: string): PrioritizationCriterion | undefined => {
    return PRIORITIZATION_CRITERIA.find(c => c.id === id);
  };

  // Get color based on weight value
  const getWeightColor = (weight: number): string => {
    if (weight <= 3) return 'bg-red-500';
    if (weight <= 6) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Prioritization & Weights
          </h2>
          <p className="text-sm text-gray-600">
            Configure how the resource allocator should prioritize different criteria
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Preset Profiles Section */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Quick Profiles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESET_PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handlePresetChange(profile.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedProfile === profile.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900 mb-1">{profile.name}</div>
              <div className="text-sm text-gray-600">{profile.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Weight Sliders Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Manual Weight Assignment</h3>
          <div className="text-sm text-gray-600">
            Total Weight: <span className="font-semibold">{totalWeight}</span>
          </div>
        </div>
        
        <div className="space-y-6">
          {PRIORITIZATION_CRITERIA.map((criterion) => {
            const currentWeight = config.weights[criterion.id] || criterion.defaultWeight;
            const percentage = totalWeight > 0 ? (currentWeight / totalWeight) * 100 : 0;
            
            return (
              <div key={criterion.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      {criterion.label}
                    </label>
                    <p className="text-xs text-gray-600">{criterion.description}</p>
                  </div>
                  <div className="flex items-center space-x-3 ml-4">
                    <span className="text-sm text-gray-600 min-w-[3rem] text-right">
                      {percentage.toFixed(1)}%
                    </span>
                    <input
                      type="number"
                      value={currentWeight}
                      onChange={(e) => handleWeightChange(criterion.id, parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={criterion.min}
                      max={criterion.max}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500 w-8">{criterion.min}</span>
                  <div className="flex-1">
                    <input
                      type="range"
                      value={currentWeight}
                      onChange={(e) => handleWeightChange(criterion.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      min={criterion.min}
                      max={criterion.max}
                      style={{
                        background: `linear-gradient(to right, ${getWeightColor(currentWeight)} 0%, ${getWeightColor(currentWeight)} ${(currentWeight / criterion.max) * 100}%, #e5e7eb ${(currentWeight / criterion.max) * 100}%, #e5e7eb 100%)`
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{criterion.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration Preview</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Method</h4>
                <p className="text-sm text-gray-600 capitalize">{config.method}</p>
                {config.presetUsed && (
                  <p className="text-xs text-blue-600 mt-1">
                    Using preset: {PRESET_PROFILES.find(p => p.id === config.presetUsed)?.name}
                  </p>
                )}
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Weight Distribution</h4>
                <div className="space-y-1">
                  {Object.entries(config.weights)
                    .sort(([, a], [, b]) => b - a)
                    .map(([id, weight]) => {
                      const criterion = getCriterion(id);
                      const percentage = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
                      return (
                        <div key={id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">{criterion?.label || id}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-12 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${getWeightColor(weight)}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-gray-600 w-8 text-right">{weight}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export/Save Section */}
      <div className="border-t border-gray-200 pt-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Configuration Status</h4>
            <p className="text-sm text-gray-600">
              {config.presetUsed 
                ? `Using ${PRESET_PROFILES.find(p => p.id === config.presetUsed)?.name} preset`
                : 'Custom configuration'
              }
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-600">
              {totalWeight === 0 ? (
                <span className="text-red-600">⚠️ No weights assigned</span>
              ) : (
                <span className="text-green-600">✅ Configuration ready</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}