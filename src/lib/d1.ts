import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Device, InstallationHistory } from '@/types';

// ==========================================
// CONFIGURATION & MODE DETECTION
// ==========================================
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || '';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';

export const isCloudflareD1Configured = Boolean(
  accountId &&
  databaseId &&
  apiToken &&
  accountId !== 'REPLACE_WITH_YOUR_ACCOUNT_ID' &&
  databaseId !== 'REPLACE_WITH_YOUR_D1_DATABASE_ID'
);

// ==========================================
// LOCAL D1 SQLITE INSTANCE (FALLBACK & DEV)
// ==========================================
let localDbInstance: DatabaseSync | null = null;

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

function getLocalDatabase(): DatabaseSync {
  if (localDbInstance) return localDbInstance;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'iot-registry.sqlite');
  const isNew = !fs.existsSync(dbPath);

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Initialize schema
  const schemaPath = path.join(process.cwd(), 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        mcid TEXT PRIMARY KEY,
        mac_address TEXT NOT NULL,
        normalized_mac TEXT NOT NULL,
        machine_model TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Installed', 'Maintenance', 'Removed')),
        installed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        notes TEXT,
        last_technician TEXT
      );
      CREATE TABLE IF NOT EXISTS mac_index (
        normalized_mac TEXT PRIMARY KEY,
        mcid TEXT NOT NULL,
        mac_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        updated_at TEXT NOT NULL,
        FOREIGN KEY(mcid) REFERENCES devices(mcid)
      );
      CREATE TABLE IF NOT EXISTS installation_history (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        mcid TEXT NOT NULL,
        mac_address TEXT NOT NULL,
        previous_mac_address TEXT,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        machine_model TEXT NOT NULL,
        location TEXT NOT NULL,
        notes TEXT,
        timestamp TEXT NOT NULL,
        performed_by TEXT NOT NULL
      );
    `);
  }

  // Pre-seed sample devices if table is empty
  const countRow = db.prepare('SELECT COUNT(*) as count FROM devices').get() as { count: number };
  if (isNew || countRow.count === 0) {
    const insertDev = db.prepare(`
      INSERT OR REPLACE INTO devices (mcid, mac_address, normalized_mac, machine_model, location, status, installed_at, updated_at, notes, last_technician)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMac = db.prepare(`
      INSERT OR REPLACE INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at)
      VALUES (?, ?, ?, 'active', ?)
    `);
    const insertHist = db.prepare(`
      INSERT OR REPLACE INTO installation_history (id, event_type, mcid, mac_address, new_status, machine_model, location, notes, timestamp, performed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    INITIAL_MOCK_DEVICES.forEach((d) => {
      insertDev.run(
        d.mcid,
        d.macAddress,
        d.normalizedMac,
        d.machineModel,
        d.location,
        d.status,
        d.installedAt,
        d.updatedAt,
        d.notes || '',
        d.lastTechnician || ''
      );
      if (d.status !== 'Removed') {
        insertMac.run(d.normalizedMac, d.mcid, d.macAddress, d.installedAt);
      }
    });

    INITIAL_MOCK_HISTORY.forEach((h) => {
      insertHist.run(
        h.id,
        h.eventType,
        h.mcid,
        h.macAddress,
        h.newStatus,
        h.machineModel,
        h.location,
        h.notes || '',
        h.timestamp,
        h.performedBy
      );
    });
  }

  localDbInstance = db;
  return db;
}

// ==========================================
// UNIFIED D1 QUERY EXECUTOR
// ==========================================

export interface D1QueryResult<T = unknown> {
  results: T[];
  success: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
    duration?: number;
  };
}

/**
 * Executes a single SQL query against Cloudflare D1 REST API or Local SQLite engine.
 */
export async function queryD1<T = unknown>(
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<D1QueryResult<T>> {
  if (isCloudflareD1Configured) {
    // Remote Cloudflare D1 REST API
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql,
          params,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Cloudflare D1 HTTP Error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.errors?.[0]?.message || 'Query Cloudflare D1 gagal.');
      }

      const firstResult = json.result?.[0];
      return {
        results: (firstResult?.results || []) as T[],
        success: true,
        meta: firstResult?.meta,
      };
    } catch (err) {
      console.error('Remote Cloudflare D1 error, falling back to local SQLite:', err);
      // Fallback to local SQLite if remote has an error
    }
  }

  // Local D1 SQLite Engine via node:sqlite
  const db = getLocalDatabase();
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT')) {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as T[];
    return {
      results: rows,
      success: true,
    };
  } else {
    const stmt = db.prepare(sql);
    const info = stmt.run(...params);
    return {
      results: [],
      success: true,
      meta: {
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }
}

/**
 * Executes a batch of SQL statements atomically in a single transaction.
 */
export async function executeD1Batch(
  statements: { sql: string; params?: (string | number | boolean | null)[] }[]
): Promise<boolean> {
  if (isCloudflareD1Configured) {
    // Remote Cloudflare D1 batch query
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
      // Batch payload in Cloudflare D1
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          statements.map((s) => ({
            sql: s.sql,
            params: s.params || [],
          }))
        ),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Cloudflare D1 Batch HTTP Error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      return json.success;
    } catch (err) {
      console.error('Remote Cloudflare D1 batch error, falling back to local SQLite:', err);
    }
  }

  // Local SQLite Atomic Transaction
  const db = getLocalDatabase();
  db.exec('BEGIN TRANSACTION;');
  try {
    for (const stmt of statements) {
      const prepared = db.prepare(stmt.sql);
      prepared.run(...(stmt.params || []));
    }
    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function resetLocalDatabase(): void {
  const db = getLocalDatabase();
  db.exec('DELETE FROM installation_history;');
  db.exec('DELETE FROM mac_index;');
  db.exec('DELETE FROM devices;');

  const insertDev = db.prepare(`
    INSERT INTO devices (mcid, mac_address, normalized_mac, machine_model, location, status, installed_at, updated_at, notes, last_technician)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMac = db.prepare(`
    INSERT INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at)
    VALUES (?, ?, ?, 'active', ?)
  `);
  const insertHist = db.prepare(`
    INSERT INTO installation_history (id, event_type, mcid, mac_address, new_status, machine_model, location, notes, timestamp, performed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  INITIAL_MOCK_DEVICES.forEach((d) => {
    insertDev.run(
      d.mcid,
      d.macAddress,
      d.normalizedMac,
      d.machineModel,
      d.location,
      d.status,
      d.installedAt,
      d.updatedAt,
      d.notes || '',
      d.lastTechnician || ''
    );
    if (d.status !== 'Removed') {
      insertMac.run(d.normalizedMac, d.mcid, d.macAddress, d.installedAt);
    }
  });

  INITIAL_MOCK_HISTORY.forEach((h) => {
    insertHist.run(
      h.id,
      h.eventType,
      h.mcid,
      h.macAddress,
      h.newStatus,
      h.machineModel,
      h.location,
      h.notes || '',
      h.timestamp,
      h.performedBy
    );
  });
}
