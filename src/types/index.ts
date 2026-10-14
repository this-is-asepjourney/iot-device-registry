export type DeviceStatus = 'Installed' | 'Maintenance' | 'Removed';

export type HistoryEventType = 'INSTALL' | 'REPLACE_DEVICE' | 'STATUS_CHANGE' | 'REMOVE';

export interface Device {
  mcid: string; // Document ID (normalized: uppercase, trimmed)
  macAddress: string; // Formatted XX:XX:XX:XX:XX:XX
  normalizedMac: string; // Without colons, uppercase: XXXXXXXXXXXX
  machineModel: string;
  location: string;
  status: DeviceStatus;
  installedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  notes?: string;
  lastTechnician?: string; // Email or user identifier
}

export interface MacIndexDoc {
  mcid: string;
  macAddress: string;
  status: 'active';
  updatedAt: string;
}

export interface InstallationHistory {
  id: string;
  eventType: HistoryEventType;
  mcid: string;
  macAddress: string;
  previousMacAddress?: string;
  previousStatus?: DeviceStatus;
  newStatus: DeviceStatus;
  machineModel: string;
  location: string;
  notes?: string;
  timestamp: string; // ISO 8601
  performedBy: string;
}

export interface InstallDevicePayload {
  mcid: string;
  macAddress: string;
  machineModel: string;
  location: string;
  notes?: string;
  technicianEmail: string;
}

export interface ReplaceDevicePayload {
  mcid: string;
  newMacAddress: string;
  notes?: string;
  technicianEmail: string;
}

export interface UpdateStatusPayload {
  mcid: string;
  newStatus: DeviceStatus;
  notes?: string;
  technicianEmail: string;
}

export const FACTORY_LIST = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'] as const;
export type FactoryCode = (typeof FACTORY_LIST)[number];

export interface EditDevicePayload {
  mcid: string;
  macAddress: string;
  machineModel: string;
  location: string;
  status: DeviceStatus;
  notes?: string;
  technicianEmail: string;
}

export interface DeleteDevicePayload {
  mcid: string;
  technicianEmail: string;
  notes?: string;
}

export interface ImportDeviceItem {
  mcid: string;
  macAddress: string;
  machineModel: string;
  factory: FactoryCode;
  line?: string;
  notes?: string;
}

export interface ImportDevicesPayload {
  items: ImportDeviceItem[];
  technicianEmail: string;
}

export interface ImportDevicesResult {
  success: boolean;
  totalRequested: number;
  importedCount: number;
  skippedCount: number;
  errors?: string[];
  message: string;
}

// ==========================================
// INSTALLATION PLANNING TYPES
// ==========================================

export type PlanStatus = 'Planned' | 'Installed' | 'Cancelled';

export interface InstallationPlan {
  id: string; // Document ID (e.g., plan-1712345678)
  mcid: string; // Machine Control ID (mandatory)
  machineModel?: string;
  location?: string;
  status: PlanStatus;
  targetDate?: string; // YYYY-MM-DD
  notes?: string;
  installedMac?: string; // Formatted MAC when mapped
  installedAt?: string; // ISO 8601 when mapped
  installedBy?: string; // Technician email
  createdAt: string; // ISO 8601
  createdBy?: string;
}

export interface CreatePlanPayload {
  mcid: string;
  machineModel?: string;
  location?: string;
  targetDate?: string;
  notes?: string;
  technicianEmail?: string;
}

export interface EditPlanPayload {
  id: string;
  mcid: string;
  machineModel?: string;
  location?: string;
  targetDate?: string;
  notes?: string;
  status?: PlanStatus;
  technicianEmail?: string;
}

export interface DeletePlanPayload {
  id: string;
  technicianEmail?: string;
}

export interface CompletePlanPayload {
  planId: string;
  mcid: string;
  macAddress: string;
  machineModel?: string;
  location?: string;
  notes?: string;
  technicianEmail: string;
}

export interface ImportPlanItem {
  mcid: string;
  machineModel?: string;
  factory?: FactoryCode | string;
  line?: string;
  targetDate?: string;
  notes?: string;
}

export interface ImportPlansPayload {
  items: ImportPlanItem[];
  technicianEmail?: string;
}

export interface ImportPlansResult {
  success: boolean;
  totalRequested: number;
  importedCount: number;
  skippedCount: number;
  errors?: string[];
  message: string;
}

