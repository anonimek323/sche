type WorkerPreference = 'day' | 'night' | 'either';
type AvailabilityPeriod = 'all' | 'day' | 'night';
type ScheduleStatus = 'draft' | 'published' | 'archived';

interface ScheduleWorker {
  id: string;
  name: string;
  target: number;
  preference: WorkerPreference;
  pair24: string;
  categories: string[];
  managerQualified: boolean;
  defaultManager: boolean;
}

interface Shift {
  label: string;
  short?: string;
  start: string;
  end: string;
  hours?: number;
  activeDays: number[];
  coverage: number;
  category: string;
  period: 'day' | 'night';
  manager: boolean;
  enabled?: boolean;
  cls?: string;
  pairGroup?: string | null;
}

interface Pairing {
  id: string;
  name: string;
  firstShiftId: string;
  secondShiftId: string;
  dayOffset: number;
  enabled: boolean;
}

interface AvailabilityEntry {
  id?: string;
  workerId: string;
  date: string;
  period: AvailabilityPeriod;
}

interface TwentyFourPair {
  id?: string;
  workerId: string;
  pairingId?: string;
  orientation?: string;
  name?: string;
  startDate: string;
  keys: string[];
}

interface ScheduleSnapshot {
  id: string;
  label: string;
  timestamp: string;
  status: ScheduleStatus;
  revision: number;
  assignments: Record<string, string>;
  locks: Record<string, boolean>;
  reasons: Record<string, string>;
  unfilledReasons: Record<string, string>;
  managerFallbacks: Record<string, string>;
  twentyFourPairs: TwentyFourPair[];
}

interface ScheduleMetadata {
  status: ScheduleStatus;
  revision: number;
  versions: ScheduleSnapshot[];
  solver?: {
    exact: boolean;
    objective: number;
    variables: number;
    constraints: number;
    generatedAt: string;
    seed: number;
  };
}

interface ScheduleHistory {
  undo: ScheduleSnapshot[];
  redo: ScheduleSnapshot[];
}

interface SheetImportBackupState {
  workers: ScheduleWorker[];
  availability: AvailabilityEntry[];
  categories: string[];
  month: string;
  at: string;
}

interface AppState {
  current: string;
  settings: { recoveryDays: number; [key: string]: number | boolean };
  minimumRestHours: number;
  workers: ScheduleWorker[];
  categories: string[];
  shifts: Record<string, Shift>;
  pairings: Pairing[];
  availability: AvailabilityEntry[];
  assignments: Record<string, string>;
  locks: Record<string, boolean>;
  assignmentReasons: Record<string, string>;
  unfilledReasons: Record<string, string>;
  managerFallbacks: Record<string, string>;
  twentyFourPairs: TwentyFourPair[];
  scheduleMeta: Record<string, ScheduleMetadata>;
  history: Record<string, ScheduleHistory>;
  lastGenerationSeed?: number;
  lastImportBackup?: SheetImportBackupState;
}

interface Interval {
  start: number;
  end: number;
  minutes: number;
}

interface ShiftInstance extends Interval {
  key: string;
  date: string;
  shiftId: string;
  index: number;
  shift: Shift;
}

interface SolverLike {
  Solve(model: unknown): Record<string, number | boolean | string> & { feasible: boolean; result?: number };
}

interface Window {
  Module: (options?: Record<string, unknown>) => Promise<any>;
  HIGHS_WASM_BASE64?: string;
  ShiftwiseEngine: any;
  ShiftwiseSheetIO: any;
  solver: SolverLike;
  XLSX: any;
  __test?: Record<string, unknown>;
}

declare const ShiftwiseEngine: {
  solve(config: AppState & { randomRanks?: Record<string, number> }, solver: SolverLike): any;
  highsAdapter(highs: any): SolverLike;
  intervalFor(date: string, shift: Shift): Interval;
  gapMinutes(left: Interval, right: Interval): number;
  pairingContinuity(pairing: Pick<Pairing, 'firstShiftId' | 'secondShiftId' | 'dayOffset'>, shifts: Record<string, Shift>): { valid: boolean; reason: string; start?: string; end?: string };
  addDays(date: string, amount: number): string;
};
declare const ShiftwiseSheetIO: {
  parseSheets(tables: { name: string; rows: unknown[][] }[], context: { workers: ScheduleWorker[]; pairings: Pairing[]; categories: string[]; currentMonth: string }): any;
  applyImport(app: AppState, result: any, options?: { addNewWorkers?: boolean; updateWorkers?: boolean; replaceAvailability?: boolean; makeId?: () => string }): SheetImportBackupState;
  restoreImportBackup(app: AppState, backup: SheetImportBackupState): void;
  buildTemplateTables(app: AppState, month: string): { name: string; rows: unknown[][] }[];
  importSummary(result: any, options?: { addNewWorkers?: boolean }): { workersUpdated: number; workersNew: number; availabilityWorkers: number; availabilityDays: number; blocked: number };
};
declare const XLSX: any;
declare const solver: SolverLike;

interface HTMLElement {
  value: any;
  checked: boolean;
  disabled: boolean;
  showModal(): void;
  close(): void;
  showPicker?(): void;
  min: string;
  max: string;
}

interface Element {
  readonly dataset: DOMStringMap;
  value: any;
  checked: boolean;
}
