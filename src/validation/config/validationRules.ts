import { DataRequirements } from '../types';

export const DATA_REQUIREMENTS: DataRequirements = {
  clients: {
    required: ['ClientID', 'ClientName', 'PriorityLevel', 'RequestedTaskIDs', 'GroupTag', 'AttributesJSON'],
    types: {
      ClientID: 'string',
      ClientName: 'string', 
      PriorityLevel: 'number',
      RequestedTaskIDs: 'array',
      GroupTag: 'string',
      AttributesJSON: 'json'
    },
    ranges: {
      PriorityLevel: { min: 1, max: 5 }
    }
  },
  workers: {
    required: ['WorkerID', 'WorkerName', 'Skills', 'AvailableSlots', 'MaxLoadPerPhase', 'WorkerGroup', 'QualificationLevel'],
    types: {
      WorkerID: 'string',
      WorkerName: 'string',
      Skills: 'string',
      AvailableSlots: 'array',
      MaxLoadPerPhase: 'number',
      WorkerGroup: 'string',
      QualificationLevel: 'string'
    },
    ranges: {
      MaxLoadPerPhase: { min: 1 }
    }
  },
  tasks: {
    required: ['TaskID', 'TaskName', 'Category', 'Duration', 'RequiredSkills', 'PreferredPhases', 'MaxConcurrent'],
    types: {
      TaskID: 'string',
      TaskName: 'string',
      Category: 'string',
      Duration: 'number',
      RequiredSkills: 'string',
      PreferredPhases: 'array',
      MaxConcurrent: 'number'
    },
    ranges: {
      Duration: { min: 1 },
      MaxConcurrent: { min: 1 }
    }
  }
};

// Header mapping patterns for intelligent header recognition
export const HEADER_PATTERNS: Record<string, RegExp[]> = {
  // Client headers
  'ClientID': [/client.*id/i, /id.*client/i, /client.*identifier/i, /customer.*id/i],
  'ClientName': [/client.*name/i, /name.*client/i, /customer.*name/i, /company.*name/i],
  'PriorityLevel': [/priority/i, /importance/i, /urgency/i, /level/i],
  'RequestedTaskIDs': [/task.*id/i, /requested.*task/i, /task.*list/i, /tasks/i],
  'GroupTag': [/group/i, /tag/i, /category/i, /type/i, /department/i],
  'AttributesJSON': [/attributes/i, /metadata/i, /properties/i, /custom/i, /json/i],
  
  // Worker headers  
  'WorkerID': [/worker.*id/i, /employee.*id/i, /staff.*id/i, /user.*id/i],
  'WorkerName': [/worker.*name/i, /employee.*name/i, /staff.*name/i, /name/i],
  'Skills': [/skill/i, /expertise/i, /capability/i, /competenc/i],
  'AvailableSlots': [/slot/i, /available/i, /schedule/i, /time/i, /hours/i],
  'MaxLoadPerPhase': [/load/i, /capacity/i, /max.*load/i, /workload/i],
  'WorkerGroup': [/group/i, /team/i, /department/i, /division/i],
  'QualificationLevel': [/qualification/i, /level/i, /grade/i, /rank/i, /experience/i],
  
  // Task headers
  'TaskID': [/task.*id/i, /job.*id/i, /work.*id/i, /id/i],
  'TaskName': [/task.*name/i, /job.*name/i, /title/i, /description/i],
  'Category': [/category/i, /type/i, /kind/i, /classification/i],
  'Duration': [/duration/i, /time/i, /hours/i, /length/i],
  'RequiredSkills': [/skill/i, /requirement/i, /needed/i, /required/i],
  'PreferredPhases': [/phase/i, /stage/i, /period/i, /when/i],
  'MaxConcurrent': [/concurrent/i, /parallel/i, /simultaneous/i, /max.*concurrent/i]
};

// Default validation configuration
export const DEFAULT_VALIDATION_CONFIG = {
  enabledValidators: [
    'RequiredColumnsValidator',
    'HeaderMappingValidator', 
    'DuplicateIDValidator',
    'JSONValidator',
    'ListFormatValidator',
    'RangeValidator',
    'TaskReferenceValidator',
    'SkillCoverageValidator',
    'WorkerCapacityValidator',
    'PhaseSaturationValidator',
    'ConcurrencyFeasibilityValidator'
  ],
  strictMode: false,
  autoFix: false,
  skipDependentValidators: false
};