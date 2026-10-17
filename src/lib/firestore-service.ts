import {
  collection,
  doc,
  runTransaction,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  Device,
  InstallationHistory,
  InstallDevicePayload,
  ReplaceDevicePayload,
  UpdateStatusPayload,
} from '@/types';
import { normalizeMcid, normalizeMacAddress, formatMacAddress } from './utils';

// ==========================================
// SIMULATOR SEED & LOCAL STORAGE FALLBACK
// ==========================================
const STORAGE_KEY_DEVICES = 'iot_registry_devices_sim';
const STORAGE_KEY_MAC_INDEX = 'iot_registry_mac_index_sim';
const STORAGE_KEY_HISTORY = 'iot_registry_history_sim';

const INITIAL_MOCK_DEVICES: Device[] = [
  {
    mcid: 'CNC-VF2-01',
    macAddress: 'B8:27:EB:4A:88:11',
    normalizedMac: 'B827EB4A8811',
    machineModel: 'Haas CNC Milling VF-2',
    location: 'Plant 1 - Machining Workshop Line A',
    status: 'Installed',
    installedAt: '2026-09-15T08:30:00.000Z',
    updatedAt: '2026-09-15T08:30:00.000Z',
    notes: 'Gateway IoT sensor getaran dan temperatur spindle.',
    lastTechnician: 'asepjourney551@gmail.com',
  },
  {
    mcid: 'PRESS-50T-02',
    macAddress: 'DC:A6:32:1B:90:34',
    normalizedMac: 'DCA6321B9034',
    machineModel: 'Aida 50 Ton Hydraulic Press',
    location: 'Plant 1 - Stamping Section Line C',
    status: 'Installed',
    installedAt: '2026-09-20T10:15:00.000Z',
    updatedAt: '2026-09-20T10:15:00.000Z',
    notes: 'Sensor stroke counter dan hidrolik pressure transmitter.',
    lastTechnician: 'asepjourney551@gmail.com',
  },
  {
    mcid: 'ROBOT-WELD-03',
    macAddress: 'E4:5F:01:8C:7D:92',
    normalizedMac: 'E45F018C7D92',
    machineModel: 'Fanuc Arc Mate 100iD',
    location: 'Plant 2 - Robotic Welding Bay 4',
    status: 'Maintenance',
    installedAt: '2026-08-10T13:45:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    notes: 'Dalam pengecekan berkala konektivitas Modbus TCP.',
    lastTechnician: 'asepjourney551@gmail.com',
  },
];

const INITIAL_MOCK_HISTORY: InstallationHistory[] = [
  {
    id: 'hist-init-01',
    eventType: 'INSTALL',
    mcid: 'CNC-VF2-01',
    macAddress: 'B8:27:EB:4A:88:11',
    newStatus: 'Installed',
    machineModel: 'Haas CNC Milling VF-2',
    location: 'Plant 1 - Machining Workshop Line A',
    notes: 'Instalasi awal IoT vibration unit.',
    timestamp: '2026-09-15T08:30:00.000Z',
    performedBy: 'asepjourney551@gmail.com',
  },
  {
    id: 'hist-init-02',
    eventType: 'INSTALL',
    mcid: 'PRESS-50T-02',
    macAddress: 'DC:A6:32:1B:90:34',
    newStatus: 'Installed',
    machineModel: 'Aida 50 Ton Hydraulic Press',
    location: 'Plant 1 - Stamping Section Line C',
    notes: 'Instalasi awal IoT pressure sensor.',
    timestamp: '2026-09-20T10:15:00.000Z',
    performedBy: 'asepjourney551@gmail.com',
  },
  {
    id: 'hist-init-03',
    eventType: 'STATUS_CHANGE',
    mcid: 'ROBOT-WELD-03',
    macAddress: 'E4:5F:01:8C:7D:92',
    previousStatus: 'Installed',
    newStatus: 'Maintenance',
    machineModel: 'Fanuc Arc Mate 100iD',
    location: 'Plant 2 - Robotic Welding Bay 4',
    notes: 'Pemeliharaan sensor berkala jadwal Q4.',
    timestamp: '2026-10-01T09:00:00.000Z',
    performedBy: 'asepjourney551@gmail.com',
  },
];

function getLocalSimData(): {
  devices: Device[];
  macIndex: Record<string, { mcid: string; macAddress: string; status: 'active'; updatedAt: string }>;
  history: InstallationHistory[];
} {
  if (typeof window === 'undefined') {
    return {
      devices: INITIAL_MOCK_DEVICES,
      macIndex: {
        B827EB4A8811: { mcid: 'CNC-VF2-01', macAddress: 'B8:27:EB:4A:88:11', status: 'active', updatedAt: '2026-09-15T08:30:00.000Z' },
        DCA6321B9034: { mcid: 'PRESS-50T-02', macAddress: 'DC:A6:32:1B:90:34', status: 'active', updatedAt: '2026-09-20T10:15:00.000Z' },
        E45F018C7D92: { mcid: 'ROBOT-WELD-03', macAddress: 'E4:5F:01:8C:7D:92', status: 'active', updatedAt: '2026-08-10T13:45:00.000Z' },
      },
      history: INITIAL_MOCK_HISTORY,
    };
  }

  const rawDev = localStorage.getItem(STORAGE_KEY_DEVICES);
  const rawMac = localStorage.getItem(STORAGE_KEY_MAC_INDEX);
  const rawHist = localStorage.getItem(STORAGE_KEY_HISTORY);

  if (!rawDev) {
    const defaultMacs: Record<string, { mcid: string; macAddress: string; status: 'active'; updatedAt: string }> = {};
    INITIAL_MOCK_DEVICES.forEach((d) => {
      if (d.status !== 'Removed') {
        defaultMacs[d.normalizedMac] = {
          mcid: d.mcid,
          macAddress: d.macAddress,
          status: 'active',
          updatedAt: d.installedAt,
        };
      }
    });
    localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(INITIAL_MOCK_DEVICES));
    localStorage.setItem(STORAGE_KEY_MAC_INDEX, JSON.stringify(defaultMacs));
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(INITIAL_MOCK_HISTORY));
    return {
      devices: INITIAL_MOCK_DEVICES,
      macIndex: defaultMacs,
      history: INITIAL_MOCK_HISTORY,
    };
  }

  return {
    devices: JSON.parse(rawDev || '[]'),
    macIndex: JSON.parse(rawMac || '{}'),
    history: JSON.parse(rawHist || '[]'),
  };
}

const localSubscribers: Array<() => void> = [];
function notifyLocalSubscribers() {
  localSubscribers.forEach((fn) => fn());
}

// ==========================================
// REAL FIRESTORE & SIMULATOR UNIFIED API
// ==========================================

/**
 * 1. ATOMIC INSTALLATION
 */
export async function installDevice(payload: InstallDevicePayload): Promise<void> {
  const normMcid = normalizeMcid(payload.mcid);
  const normMac = normalizeMacAddress(payload.macAddress);
  const formattedMac = formatMacAddress(payload.macAddress);

  if (!normMcid) throw new Error('MCID tidak boleh kosong.');
  if (normMac.length !== 12) throw new Error('Format MAC Address harus valid 12 digit heksadesimal.');

  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    await runTransaction(firestore, async (txn) => {
      const deviceRef = doc(firestore, 'devices', normMcid);
      const macIndexRef = doc(firestore, 'macIndex', normMac);

      const deviceSnap = await txn.get(deviceRef);
      const macSnap = await txn.get(macIndexRef);

      if (deviceSnap.exists()) {
        const existingData = deviceSnap.data() as Device;
        if (existingData.status === 'Installed' || existingData.status === 'Maintenance') {
          throw new Error(
            `Mesin (MCID: ${normMcid}) sudah memiliki perangkat terdaftar (Status: ${existingData.status}, MAC: ${existingData.macAddress}). Gunakan menu "Ganti Perangkat" jika ingin mengganti modul IoT.`
          );
        }
      }

      if (macSnap.exists()) {
        const macData = macSnap.data();
        throw new Error(
          `MAC Address [${formattedMac}] sudah terhubung aktif ke mesin MCID: [${macData.mcid}]. Satu MAC Address hanya boleh dipakai oleh satu mesin aktif.`
        );
      }

      const now = new Date().toISOString();

      // 1. Claim in macIndex
      txn.set(macIndexRef, {
        mcid: normMcid,
        macAddress: formattedMac,
        status: 'active',
        updatedAt: now,
      });

      // 2. Write to devices
      txn.set(deviceRef, {
        mcid: normMcid,
        macAddress: formattedMac,
        normalizedMac: normMac,
        machineModel: payload.machineModel?.trim() || '',
        location: payload.location.trim(),
        status: 'Installed',
        installedAt: payload.installedAt || now,
        updatedAt: now,
        notes: payload.notes?.trim() || '',
        lastTechnician: payload.technicianEmail,
      });

      // 3. Write to installationHistory
      const historyCol = collection(firestore, 'installationHistory');
      const histDocRef = doc(historyCol);
      txn.set(histDocRef, {
        id: histDocRef.id,
        eventType: 'INSTALL',
        mcid: normMcid,
        macAddress: formattedMac,
        newStatus: 'Installed',
        machineModel: payload.machineModel?.trim() || '',
        location: payload.location.trim(),
        notes: payload.notes?.trim() || 'Pemasangan awal perangkat IoT pada mesin.',
        timestamp: payload.installedAt || now,
        performedBy: payload.technicianEmail,
      });
    });
    return;
  }

  // Fallback simulator transaction
  const data = getLocalSimData();
  const existingDev = data.devices.find((d) => d.mcid === normMcid);
  if (existingDev && (existingDev.status === 'Installed' || existingDev.status === 'Maintenance')) {
    throw new Error(
      `Mesin (MCID: ${normMcid}) sudah memiliki perangkat aktif (Status: ${existingDev.status}, MAC: ${existingDev.macAddress}). Gunakan fitur "Ganti Perangkat".`
    );
  }

  if (data.macIndex[normMac]) {
    const owner = data.macIndex[normMac].mcid;
    throw new Error(
      `MAC Address [${formattedMac}] sudah terhubung aktif ke mesin MCID: [${owner}]. Satu MAC Address hanya boleh dipakai oleh satu mesin aktif.`
    );
  }

  const now = new Date().toISOString();
  data.macIndex[normMac] = {
    mcid: normMcid,
    macAddress: formattedMac,
    status: 'active',
    updatedAt: now,
  };

  const newDevice: Device = {
    mcid: normMcid,
    macAddress: formattedMac,
    normalizedMac: normMac,
    machineModel: payload.machineModel?.trim() || '',
    location: payload.location.trim(),
    status: 'Installed',
    installedAt: payload.installedAt || now,
    updatedAt: now,
    notes: payload.notes?.trim() || '',
    lastTechnician: payload.technicianEmail,
  };

  const updatedDevices = data.devices.filter((d) => d.mcid !== normMcid);
  updatedDevices.unshift(newDevice);

  const histEntry: InstallationHistory = {
    id: `hist-${Date.now()}`,
    eventType: 'INSTALL',
    mcid: normMcid,
    macAddress: formattedMac,
    newStatus: 'Installed',
    machineModel: payload.machineModel?.trim() || '',
    location: payload.location.trim(),
    notes: payload.notes?.trim() || 'Pemasangan awal perangkat IoT pada mesin.',
    timestamp: now,
    performedBy: payload.technicianEmail,
  };
  data.history.unshift(histEntry);

  localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(updatedDevices));
  localStorage.setItem(STORAGE_KEY_MAC_INDEX, JSON.stringify(data.macIndex));
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(data.history));
  notifyLocalSubscribers();
}

/**
 * 2. ATOMIC REPLACE DEVICE
 */
export async function replaceDevice(payload: ReplaceDevicePayload): Promise<void> {
  const normMcid = normalizeMcid(payload.mcid);
  const normNewMac = normalizeMacAddress(payload.newMacAddress);
  const formattedNewMac = formatMacAddress(payload.newMacAddress);

  if (!normMcid) throw new Error('MCID tidak boleh kosong.');
  if (normNewMac.length !== 12) throw new Error('Format MAC Address baru harus valid 12 digit heksadesimal.');

  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    await runTransaction(firestore, async (txn) => {
      const deviceRef = doc(firestore, 'devices', normMcid);
      const newMacIndexRef = doc(firestore, 'macIndex', normNewMac);

      const deviceSnap = await txn.get(deviceRef);
      if (!deviceSnap.exists()) {
        throw new Error(`Data mesin dengan MCID [${normMcid}] tidak ditemukan.`);
      }

      const currentDev = deviceSnap.data() as Device;
      const oldNormMac = currentDev.normalizedMac || normalizeMacAddress(currentDev.macAddress);
      const oldFormattedMac = currentDev.macAddress;

      if (oldNormMac === normNewMac) {
        throw new Error(`MAC Address baru identik dengan MAC Address yang sedang terpasang (${oldFormattedMac}).`);
      }

      const newMacSnap = await txn.get(newMacIndexRef);
      if (newMacSnap.exists()) {
        const owner = newMacSnap.data().mcid;
        throw new Error(
          `MAC Address baru [${formattedNewMac}] sudah digunakan oleh MCID: [${owner}]. Gunakan modul MAC yang belum aktif.`
        );
      }

      const now = new Date().toISOString();

      // 1. Release old MAC
      if (oldNormMac) {
        const oldMacIndexRef = doc(firestore, 'macIndex', oldNormMac);
        txn.delete(oldMacIndexRef);
      }

      // 2. Claim new MAC
      txn.set(newMacIndexRef, {
        mcid: normMcid,
        macAddress: formattedNewMac,
        status: 'active',
        updatedAt: now,
      });

      // 3. Update device document
      txn.update(deviceRef, {
        macAddress: formattedNewMac,
        normalizedMac: normNewMac,
        status: 'Installed',
        updatedAt: now,
        notes: payload.notes?.trim() || currentDev.notes || '',
        lastTechnician: payload.technicianEmail,
      });

      // 4. Log to history
      const historyCol = collection(firestore, 'installationHistory');
      const histDocRef = doc(historyCol);
      txn.set(histDocRef, {
        id: histDocRef.id,
        eventType: 'REPLACE_DEVICE',
        mcid: normMcid,
        macAddress: formattedNewMac,
        previousMacAddress: oldFormattedMac,
        previousStatus: currentDev.status,
        newStatus: 'Installed',
        machineModel: currentDev.machineModel,
        location: currentDev.location,
        notes: payload.notes?.trim() || `Penggantian IoT device dari ${oldFormattedMac} ke ${formattedNewMac}.`,
        timestamp: now,
        performedBy: payload.technicianEmail,
      });
    });
    return;
  }

  // Fallback simulator
  const data = getLocalSimData();
  const devIndex = data.devices.findIndex((d) => d.mcid === normMcid);
  if (devIndex === -1) {
    throw new Error(`Data mesin dengan MCID [${normMcid}] tidak ditemukan.`);
  }

  const currentDev = data.devices[devIndex];
  const oldNormMac = currentDev.normalizedMac || normalizeMacAddress(currentDev.macAddress);
  const oldFormattedMac = currentDev.macAddress;

  if (oldNormMac === normNewMac) {
    throw new Error(`MAC Address baru sama dengan MAC Address saat ini (${oldFormattedMac}).`);
  }

  if (data.macIndex[normNewMac]) {
    const owner = data.macIndex[normNewMac].mcid;
    throw new Error(
      `MAC Address baru [${formattedNewMac}] sudah digunakan oleh MCID: [${owner}].`
    );
  }

  const now = new Date().toISOString();

  // Release old MAC
  if (oldNormMac) {
    delete data.macIndex[oldNormMac];
  }

  // Claim new MAC
  data.macIndex[normNewMac] = {
    mcid: normMcid,
    macAddress: formattedNewMac,
    status: 'active',
    updatedAt: now,
  };

  // Update device
  data.devices[devIndex] = {
    ...currentDev,
    macAddress: formattedNewMac,
    normalizedMac: normNewMac,
    status: 'Installed',
    updatedAt: now,
    notes: payload.notes?.trim() || currentDev.notes || '',
    lastTechnician: payload.technicianEmail,
  };

  // Log history
  data.history.unshift({
    id: `hist-${Date.now()}`,
    eventType: 'REPLACE_DEVICE',
    mcid: normMcid,
    macAddress: formattedNewMac,
    previousMacAddress: oldFormattedMac,
    previousStatus: currentDev.status,
    newStatus: 'Installed',
    machineModel: currentDev.machineModel,
    location: currentDev.location,
    notes: payload.notes?.trim() || `Penggantian IoT device dari ${oldFormattedMac} ke ${formattedNewMac}.`,
    timestamp: now,
    performedBy: payload.technicianEmail,
  });

  localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(data.devices));
  localStorage.setItem(STORAGE_KEY_MAC_INDEX, JSON.stringify(data.macIndex));
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(data.history));
  notifyLocalSubscribers();
}

/**
 * 3. ATOMIC STATUS CHANGE / REMOVAL
 */
export async function updateDeviceStatus(payload: UpdateStatusPayload): Promise<void> {
  const normMcid = normalizeMcid(payload.mcid);
  if (!normMcid) throw new Error('MCID tidak boleh kosong.');

  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    await runTransaction(firestore, async (txn) => {
      const deviceRef = doc(firestore, 'devices', normMcid);
      const deviceSnap = await txn.get(deviceRef);
      if (!deviceSnap.exists()) {
        throw new Error(`Data mesin dengan MCID [${normMcid}] tidak ditemukan.`);
      }

      const currentDev = deviceSnap.data() as Device;
      const oldStatus = currentDev.status;
      const normMac = currentDev.normalizedMac || normalizeMacAddress(currentDev.macAddress);
      const macIndexRef = doc(firestore, 'macIndex', normMac);

      if (oldStatus === payload.newStatus) {
        return; // Nothing to change
      }

      const now = new Date().toISOString();

      if (payload.newStatus === 'Removed') {
        // Release MAC from macIndex so it can be re-used later
        txn.delete(macIndexRef);

        txn.update(deviceRef, {
          status: 'Removed',
          updatedAt: now,
          notes: payload.notes?.trim() || currentDev.notes || '',
          lastTechnician: payload.technicianEmail,
        });

        const historyCol = collection(firestore, 'installationHistory');
        const histDocRef = doc(historyCol);
        txn.set(histDocRef, {
          id: histDocRef.id,
          eventType: 'REMOVE',
          mcid: normMcid,
          macAddress: currentDev.macAddress,
          previousStatus: oldStatus,
          newStatus: 'Removed',
          machineModel: currentDev.machineModel,
          location: currentDev.location,
          notes: payload.notes?.trim() || `Perangkat dilepas dari mesin (MAC ${currentDev.macAddress} dilepas dari indeks aktif).`,
          timestamp: now,
          performedBy: payload.technicianEmail,
        });
      } else if (payload.newStatus === 'Installed' && oldStatus === 'Removed') {
        // If re-installing a previously removed device, re-claim MAC
        const macSnap = await txn.get(macIndexRef);
        if (macSnap.exists()) {
          const owner = macSnap.data().mcid;
          throw new Error(
            `MAC Address [${currentDev.macAddress}] telah digunakan oleh MCID: [${owner}]. Gunakan fitur "Ganti Perangkat" untuk memasang modul MAC baru.`
          );
        }

        txn.set(macIndexRef, {
          mcid: normMcid,
          macAddress: currentDev.macAddress,
          status: 'active',
          updatedAt: now,
        });

        txn.update(deviceRef, {
          status: 'Installed',
          updatedAt: now,
          notes: payload.notes?.trim() || currentDev.notes || '',
          lastTechnician: payload.technicianEmail,
        });

        const historyCol = collection(firestore, 'installationHistory');
        const histDocRef = doc(historyCol);
        txn.set(histDocRef, {
          id: histDocRef.id,
          eventType: 'STATUS_CHANGE',
          mcid: normMcid,
          macAddress: currentDev.macAddress,
          previousStatus: oldStatus,
          newStatus: 'Installed',
          machineModel: currentDev.machineModel,
          location: currentDev.location,
          notes: payload.notes?.trim() || `Status dikembalikan ke Installed.`,
          timestamp: now,
          performedBy: payload.technicianEmail,
        });
      } else {
        // Regular status change (e.g., Installed <-> Maintenance)
        txn.update(deviceRef, {
          status: payload.newStatus,
          updatedAt: now,
          notes: payload.notes?.trim() || currentDev.notes || '',
          lastTechnician: payload.technicianEmail,
        });

        const historyCol = collection(firestore, 'installationHistory');
        const histDocRef = doc(historyCol);
        txn.set(histDocRef, {
          id: histDocRef.id,
          eventType: 'STATUS_CHANGE',
          mcid: normMcid,
          macAddress: currentDev.macAddress,
          previousStatus: oldStatus,
          newStatus: payload.newStatus,
          machineModel: currentDev.machineModel,
          location: currentDev.location,
          notes: payload.notes?.trim() || `Status mesin diubah menjadi ${payload.newStatus}.`,
          timestamp: now,
          performedBy: payload.technicianEmail,
        });
      }
    });
    return;
  }

  // Fallback simulator
  const data = getLocalSimData();
  const devIndex = data.devices.findIndex((d) => d.mcid === normMcid);
  if (devIndex === -1) {
    throw new Error(`Data mesin dengan MCID [${normMcid}] tidak ditemukan.`);
  }

  const currentDev = data.devices[devIndex];
  const oldStatus = currentDev.status;
  const normMac = currentDev.normalizedMac || normalizeMacAddress(currentDev.macAddress);

  if (oldStatus === payload.newStatus) return;

  const now = new Date().toISOString();

  if (payload.newStatus === 'Removed') {
    delete data.macIndex[normMac];
    data.devices[devIndex] = {
      ...currentDev,
      status: 'Removed',
      updatedAt: now,
      notes: payload.notes?.trim() || currentDev.notes || '',
      lastTechnician: payload.technicianEmail,
    };
    data.history.unshift({
      id: `hist-${Date.now()}`,
      eventType: 'REMOVE',
      mcid: normMcid,
      macAddress: currentDev.macAddress,
      previousStatus: oldStatus,
      newStatus: 'Removed',
      machineModel: currentDev.machineModel,
      location: currentDev.location,
      notes: payload.notes?.trim() || `Perangkat dilepas dari mesin (MAC ${currentDev.macAddress} dilepas dari indeks aktif).`,
      timestamp: now,
      performedBy: payload.technicianEmail,
    });
  } else if (payload.newStatus === 'Installed' && oldStatus === 'Removed') {
    if (data.macIndex[normMac]) {
      const owner = data.macIndex[normMac].mcid;
      throw new Error(`MAC Address [${currentDev.macAddress}] telah digunakan oleh MCID: [${owner}].`);
    }
    data.macIndex[normMac] = {
      mcid: normMcid,
      macAddress: currentDev.macAddress,
      status: 'active',
      updatedAt: now,
    };
    data.devices[devIndex] = {
      ...currentDev,
      status: 'Installed',
      updatedAt: now,
      notes: payload.notes?.trim() || currentDev.notes || '',
      lastTechnician: payload.technicianEmail,
    };
    data.history.unshift({
      id: `hist-${Date.now()}`,
      eventType: 'STATUS_CHANGE',
      mcid: normMcid,
      macAddress: currentDev.macAddress,
      previousStatus: oldStatus,
      newStatus: 'Installed',
      machineModel: currentDev.machineModel,
      location: currentDev.location,
      notes: payload.notes?.trim() || `Status dikembalikan ke Installed.`,
      timestamp: now,
      performedBy: payload.technicianEmail,
    });
  } else {
    data.devices[devIndex] = {
      ...currentDev,
      status: payload.newStatus,
      updatedAt: now,
      notes: payload.notes?.trim() || currentDev.notes || '',
      lastTechnician: payload.technicianEmail,
    };
    data.history.unshift({
      id: `hist-${Date.now()}`,
      eventType: 'STATUS_CHANGE',
      mcid: normMcid,
      macAddress: currentDev.macAddress,
      previousStatus: oldStatus,
      newStatus: payload.newStatus,
      machineModel: currentDev.machineModel,
      location: currentDev.location,
      notes: payload.notes?.trim() || `Status mesin diubah menjadi ${payload.newStatus}.`,
      timestamp: now,
      performedBy: payload.technicianEmail,
    });
  }

  localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(data.devices));
  localStorage.setItem(STORAGE_KEY_MAC_INDEX, JSON.stringify(data.macIndex));
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(data.history));
  notifyLocalSubscribers();
}

/**
 * Real-time subscription to Devices collection
 */
export function subscribeDevices(
  onData: (devices: Device[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    try {
      const q = query(collection(firestore, 'devices'), orderBy('updatedAt', 'desc'));
      return onSnapshot(
        q,
        (snapshot) => {
          const list: Device[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as Device);
          });
          onData(list);
        },
        (err) => {
          console.error('Firestore subscribeDevices error:', err);
          if (onError) onError(err);
        }
      );
    } catch (e) {
      console.warn('Falling back to local simulator due to Firestore subscription error:', e);
    }
  }

  // Local fallback
  const send = () => {
    const data = getLocalSimData();
    onData(data.devices);
  };
  send();

  localSubscribers.push(send);
  return () => {
    const idx = localSubscribers.indexOf(send);
    if (idx > -1) localSubscribers.splice(idx, 1);
  };
}

/**
 * Real-time subscription to Installation History collection
 */
export function subscribeHistory(
  onData: (history: InstallationHistory[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    try {
      const q = query(collection(firestore, 'installationHistory'), orderBy('timestamp', 'desc'));
      return onSnapshot(
        q,
        (snapshot) => {
          const list: InstallationHistory[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as InstallationHistory);
          });
          onData(list);
        },
        (err) => {
          console.error('Firestore subscribeHistory error:', err);
          if (onError) onError(err);
        }
      );
    } catch (e) {
      console.warn('Falling back to local simulator due to Firestore subscription error:', e);
    }
  }

  // Local fallback
  const send = () => {
    const data = getLocalSimData();
    onData(data.history);
  };
  send();

  localSubscribers.push(send);
  return () => {
    const idx = localSubscribers.indexOf(send);
    if (idx > -1) localSubscribers.splice(idx, 1);
  };
}

/**
 * Reset simulated local storage demo data back to default fixtures.
 */
export function resetSimulatorData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_DEVICES);
  localStorage.removeItem(STORAGE_KEY_MAC_INDEX);
  localStorage.removeItem(STORAGE_KEY_HISTORY);
  getLocalSimData();
  notifyLocalSubscribers();
}
