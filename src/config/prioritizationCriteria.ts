export interface PrioritizationCriterion {
  id: string;
  label: string;
  description: string;
  defaultWeight: number;
  min: number;
  max: number;
}

export const PRIORITIZATION_CRITERIA: PrioritizationCriterion[] = [
  {
    id: "priorityLevel",
    label: "Client Priority Level",
    description: "Higher weight prioritizes clients with higher priority levels",
    defaultWeight: 5,
    min: 0,
    max: 10
  },
  {
    id: "taskFulfillment",
    label: "Requested Task Fulfillment",
    description: "Higher weight prioritizes completing more requested tasks",
    defaultWeight: 8,
    min: 0,
    max: 10
  },
  {
    id: "fairness",
    label: "Fairness Across Clients/Workers",
    description: "Higher weight ensures more balanced resource distribution",
    defaultWeight: 6,
    min: 0,
    max: 10
  },
  {
    id: "skillMatch",
    label: "Skill-to-Task Matching",
    description: "Higher weight prioritizes optimal skill alignment",
    defaultWeight: 7,
    min: 0,
    max: 10
  },
  {
    id: "loadBalancing",
    label: "Worker Load Balance",
    description: "Higher weight ensures even workload distribution",
    defaultWeight: 5,
    min: 0,
    max: 10
  }
];

export interface PrioritizationProfile {
  id: string;
  name: string;
  description: string;
  weights: Record<string, number>;
}

export const PRESET_PROFILES: PrioritizationProfile[] = [
  {
    id: "maximizeFulfillment",
    name: "Maximize Fulfillment",
    description: "Focus on completing as many requested tasks as possible",
    weights: {
      priorityLevel: 3,
      taskFulfillment: 10,
      fairness: 4,
      skillMatch: 5,
      loadBalancing: 3
    }
  },
  {
    id: "fairDistribution",
    name: "Fair Distribution",
    description: "Prioritize balanced resource allocation across all clients",
    weights: {
      priorityLevel: 4,
      taskFulfillment: 6,
      fairness: 10,
      skillMatch: 5,
      loadBalancing: 8
    }
  },
  {
    id: "minimizeWorkload",
    name: "Minimize Workload",
    description: "Optimize for efficient use of worker capacity",
    weights: {
      priorityLevel: 5,
      taskFulfillment: 4,
      fairness: 6,
      skillMatch: 7,
      loadBalancing: 10
    }
  },
  {
    id: "qualityFirst",
    name: "Quality First",
    description: "Prioritize optimal skill matching for highest quality outcomes",
    weights: {
      priorityLevel: 6,
      taskFulfillment: 5,
      fairness: 5,
      skillMatch: 10,
      loadBalancing: 4
    }
  },
  {
    id: "vipClientsFirst",
    name: "VIP Clients First",
    description: "Prioritize high-priority clients above all else",
    weights: {
      priorityLevel: 10,
      taskFulfillment: 7,
      fairness: 2,
      skillMatch: 6,
      loadBalancing: 3
    }
  }
];

export interface PrioritizationConfig {
  method: "slider" | "drag" | "ahp" | "preset";
  weights: Record<string, number>;
  presetUsed?: string;
  customName?: string;
}

export const DEFAULT_PRIORITIZATION_CONFIG: PrioritizationConfig = {
  method: "slider",
  weights: PRIORITIZATION_CRITERIA.reduce((acc, criterion) => {
    acc[criterion.id] = criterion.defaultWeight;
    return acc;
  }, {} as Record<string, number>)
};