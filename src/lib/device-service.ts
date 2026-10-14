import {
  Device,
  InstallationHistory,
  InstallDevicePayload,
  ReplaceDevicePayload,
  UpdateStatusPayload,
  ImportDevicesPayload,
  ImportDevicesResult,
  InstallationPlan,
  CreatePlanPayload,
  EditPlanPayload,
  DeletePlanPayload,
  CompletePlanPayload,
  ImportPlansPayload,
  ImportPlansResult,
} from '@/types';

type Listener = () => void;
const changeListeners: Listener[] = [];

export function notifyDataChange(): void {
  changeListeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.warn('Listener error:', err);
    }
  });
}

/**
 * Fetch all devices from Cloudflare D1
 */
export async function fetchDevices(): Promise<Device[]> {
  const res = await fetch('/api/devices', { cache: 'no-store' });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal memuat data perangkat dari D1.');
  }
  return json.data;
}

/**
 * Fetch installation audit history from Cloudflare D1
 */
export async function fetchHistory(): Promise<InstallationHistory[]> {
  const res = await fetch('/api/history', { cache: 'no-store' });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal memuat riwayat dari D1.');
  }
  return json.data;
}

export interface DatabaseSyncStatus {
  connected: boolean;
  latencyMs?: number;
  lastSyncTime: string;
}

/**
 * Check real-time database connectivity and synchronization
 */
export async function checkDatabaseStatus(): Promise<DatabaseSyncStatus> {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const json = await res.json();
    return {
      connected: Boolean(json.connected),
      latencyMs: json.latencyMs,
      lastSyncTime: new Date().toLocaleTimeString('id-ID'),
    };
  } catch {
    return {
      connected: false,
      lastSyncTime: new Date().toLocaleTimeString('id-ID'),
    };
  }
}


/**
 * Install new IoT device (Atomic 1:1 transaction)
 */
export async function installDevice(payload: InstallDevicePayload): Promise<void> {
  const res = await fetch('/api/devices/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal menyimpan instalasi.');
  }
  notifyDataChange();
}

/**
 * Replace device / swap MAC (Atomic transaction)
 */
export async function replaceDevice(payload: ReplaceDevicePayload): Promise<void> {
  const res = await fetch('/api/devices/replace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal mengganti perangkat.');
  }
  notifyDataChange();
}

/**
 * Update machine status or remove (Atomic transaction)
 */
export async function updateDeviceStatus(payload: UpdateStatusPayload): Promise<void> {
  const res = await fetch('/api/devices/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal memperbarui status.');
  }
  notifyDataChange();
}

/**
 * Edit existing device details (CRUD Update with 1:1 validation)
 */
export async function editDevice(payload: import('@/types').EditDevicePayload): Promise<void> {
  const res = await fetch('/api/devices/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal memperbarui data perangkat.');
  }
  notifyDataChange();
}

/**
 * Delete device from registry (CRUD Delete)
 */
export async function deleteDevice(payload: import('@/types').DeleteDevicePayload): Promise<void> {
  const res = await fetch('/api/devices/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal menghapus perangkat.');
  }
  notifyDataChange();
}

/**
 * Import batch devices from CSV/file data
 */
export async function importDevices(payload: ImportDevicesPayload): Promise<ImportDevicesResult> {
  const res = await fetch('/api/devices/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success && !json.importedCount) {
    throw new Error(json.error || 'Gagal mengimpor data perangkat.');
  }
  notifyDataChange();
  return json;
}


/**
 * Reset demo database
 */
export async function resetDatabase(): Promise<void> {
  const res = await fetch('/api/status', { method: 'POST' });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal mereset database.');
  }
  notifyDataChange();
}

/**
 * Real-time reactive subscription for Devices
 */
export function subscribeDevices(
  onData: (devices: Device[]) => void,
  onError?: (err: Error) => void
): () => void {
  let active = true;

  const load = async () => {
    try {
      const data = await fetchDevices();
      if (active) onData(data);
    } catch (err) {
      if (active && onError && err instanceof Error) {
        onError(err);
      }
    }
  };

  load();

  const listener = () => {
    load();
  };

  changeListeners.push(listener);

  // Poll periodically as fallback
  const interval = setInterval(load, 5000);

  return () => {
    active = false;
    clearInterval(interval);
    const idx = changeListeners.indexOf(listener);
    if (idx > -1) changeListeners.splice(idx, 1);
  };
}

/**
 * Real-time reactive subscription for History
 */
export function subscribeHistory(
  onData: (history: InstallationHistory[]) => void,
  onError?: (err: Error) => void
): () => void {
  let active = true;

  const load = async () => {
    try {
      const data = await fetchHistory();
      if (active) onData(data);
    } catch (err) {
      if (active && onError && err instanceof Error) {
        onError(err);
      }
    }
  };

  load();

  const listener = () => {
    load();
  };

  changeListeners.push(listener);

  // Poll periodically as fallback
  const interval = setInterval(load, 5000);

  return () => {
    active = false;
    clearInterval(interval);
    const idx = changeListeners.indexOf(listener);
    if (idx > -1) changeListeners.splice(idx, 1);
  };
}

// ==========================================
// INSTALLATION PLANNING SERVICE FUNCTIONS
// ==========================================

/**
 * Fetch all installation plans
 */
export async function fetchPlans(): Promise<InstallationPlan[]> {
  const res = await fetch('/api/plans', { cache: 'no-store' });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal memuat rencana pemasangan.');
  }
  return json.data;
}

/**
 * Create a new installation plan manually
 */
export async function createPlan(payload: CreatePlanPayload): Promise<InstallationPlan> {
  const res = await fetch('/api/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal membuat rencana pemasangan.');
  }
  notifyDataChange();
  return json.data;
}

/**
 * Edit an existing installation plan
 */
export async function editPlan(payload: EditPlanPayload): Promise<void> {
  const res = await fetch('/api/plans/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal memperbarui rencana pemasangan.');
  }
  notifyDataChange();
}

/**
 * Delete an installation plan
 */
export async function deletePlan(payload: DeletePlanPayload): Promise<void> {
  const res = await fetch('/api/plans/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal menghapus rencana pemasangan.');
  }
  notifyDataChange();
}

/**
 * Complete a plan by mapping and installing IoT device with MAC Address
 */
export async function completePlan(payload: CompletePlanPayload): Promise<void> {
  const res = await fetch('/api/plans/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Gagal memetakan dan menyelesaikan instalasi.');
  }
  notifyDataChange();
}

/**
 * Import batch installation plans from Excel / CSV
 */
export async function importPlans(payload: ImportPlansPayload): Promise<ImportPlansResult> {
  const res = await fetch('/api/plans/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.success && !json.importedCount) {
    throw new Error(json.error || 'Gagal mengimpor data rencana pemasangan.');
  }
  notifyDataChange();
  return json;
}

/**
 * Real-time reactive subscription for Installation Plans
 */
export function subscribePlans(
  onData: (plans: InstallationPlan[]) => void,
  onError?: (err: Error) => void
): () => void {
  let active = true;

  const load = async () => {
    try {
      const data = await fetchPlans();
      if (active) onData(data);
    } catch (err) {
      if (active && onError && err instanceof Error) {
        onError(err);
      }
    }
  };

  load();

  const listener = () => {
    load();
  };

  changeListeners.push(listener);

  const interval = setInterval(load, 5000);

  return () => {
    active = false;
    clearInterval(interval);
    const idx = changeListeners.indexOf(listener);
    if (idx > -1) changeListeners.splice(idx, 1);
  };
}

