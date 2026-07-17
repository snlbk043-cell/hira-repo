export type Direction = 'Higher Better' | 'Lower Better';

export type Aggregation = 'Sum' | 'Average' | 'Latest Value' | 'Minimum' | 'Maximum' | 'Count';

export type PQSDC = 'Productivity / People' | 'Quality' | 'Safety' | 'Delivery' | 'Cost';

export type ActionStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Pending Support'
  | 'On Hold'
  | 'Completed';

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export type KpiStatus = 'Achieved' | 'Watch' | 'Action Needed' | 'Support Required' | 'No Data';

export type TrendDirection = 'Improving' | 'Deteriorating' | 'Stable' | 'Insufficient Data';

export type ForecastSignal = 'On Track' | 'At Risk' | 'Off Track' | 'No Data';

/** A department master record. */
export interface Department {
  id: string;
  name: string;
  managerTitle: string;
}

/** Master definition for a single KPI — mirrors the "KPI Definition Master" sheet. */
export interface KpiDefinition {
  kpiId: string;
  department: string;
  pqsdc: PQSDC;
  name: string;
  unit: string;
  direction: Direction;
  aggregation: Aggregation;
  target: number;
  recoveryLimit: number;
  weight: number;
  owner: string;
}

/** One month of daily actuals + tracking fields for a KPI — mirrors "KPI Data Entry". */
export interface KpiRecord {
  recordId: string;
  kpiId: string;
  year: number;
  month: string;
  monthNo: number;
  /** index 0 = Day 1 ... index 30 = Day 31. null = not entered. */
  days: (number | null)[];
  challengeReason: string;
  recoveryPlan: string;
  supportRequired: 'Yes' | 'No';
  supportDepartment: string | null;
  actionOwner: string | null;
  dueDate: string | null;
  actionStatus: ActionStatus | null;
  priority: Priority | null;
  hodRemarks: string;
  lastUpdated: string;
}

export interface MasterLists {
  departments: string[];
  pillars: PQSDC[];
  units: string[];
  directions: Direction[];
  aggregations: Aggregation[];
  owners: string[];
  years: number[];
  months: string[];
  actionStatuses: ActionStatus[];
  priorities: Priority[];
}

/** Leadership sign-off record for a single review period, keyed "YYYY-Month". */
export interface LeadershipReview {
  reviewedBy: string;
  designation: string;
  reviewDate: string | null;
  comments: string;
  decision: string;
}

export interface AppState {
  kpiDefinitions: KpiDefinition[];
  kpiRecords: KpiRecord[];
  masterLists: MasterLists;
  meta: {
    lastDataUpdate: string;
    companyName: string;
    plantName: string;
    preparedBy: string;
    dueSoonDays: number;
  };
  leadershipReviews: Record<string, LeadershipReview>;
}

export interface Filters {
  year: number;
  month: string;
  department: string; // 'All' or department name
  pqsdc: string; // 'All' or pillar name
  day: number; // 1-31 selected day
  status: string; // 'All' or KpiStatus
}
