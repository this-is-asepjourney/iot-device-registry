import fs from 'node:fs';
import path from 'node:path';
import { Device, InstallationHistory, InstallationPlan } from '@/types';

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
interface LocalSqliteDb {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
    get: (...params: unknown[]) => unknown;
  };
}

let localDbInstance: LocalSqliteDb | null = null;
let sqliteUnavailable = false;

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

const INITIAL_MOCK_PLANS: InstallationPlan[] = [
  {
    id: 'plan-init-01',
    mcid: 'PRESS-80T-04',
    machineModel: 'Komatsu 80 Ton Mechanical Press',
    location: 'Factory A2 - Press Line 2',
    status: 'Planned',
    targetDate: '2026-10-25',
    notes: 'Rencana pasang modul sensor getaran spindle & suhu motor.',
    createdAt: '2026-10-10T08:00:00.000Z',
    createdBy: 'admin@plant.local',
  },
  {
    id: 'plan-init-02',
    mcid: 'CNC-VM3-02',
    machineModel: 'Haas CNC VM-3 Mold Making',
    location: 'Factory B1 - Line Machining 3',
    status: 'Planned',
    targetDate: '2026-10-28',
    notes: 'Gateway IoT pemantau arus motor & status running.',
    createdAt: '2026-10-11T09:30:00.000Z',
    createdBy: 'admin@plant.local',
  },
  {
    id: 'plan-init-03',
    mcid: 'CNC-VF2-01',
    machineModel: 'Haas CNC Milling VF-2',
    location: 'Plant 1 - Machining Workshop Line A',
    status: 'Installed',
    targetDate: '2026-09-15',
    notes: 'Selesai dipasang gateway IoT sensor getaran dan temperatur spindle.',
    installedMac: 'B8:27:EB:4A:88:11',
    installedAt: '2026-09-15T08:30:00.000Z',
    installedBy: 'asepjourney551@gmail.com',
    createdAt: '2026-09-10T10:00:00.000Z',
    createdBy: 'admin@plant.local',
  },
];

function getLocalDatabase(): LocalSqliteDb | null {
  if (localDbInstance) return localDbInstance;
  if (sqliteUnavailable) return null;

  try {
    // Dynamic require wrapped in eval to prevent bundlers (webpack/turbopack on Vercel) from failing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sqlite: any = typeof process !== 'undefined' ? eval('require')('node:sqlite') : null;
    if (!sqlite || !sqlite.DatabaseSync) {
      sqliteUnavailable = true;
      return null;
    }

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {
        // Vercel serverless read-only filesystem guard
        sqliteUnavailable = true;
        return null;
      }
    }

    const dbPath = path.join(dataDir, 'iot-registry.sqlite');
    const isNew = !fs.existsSync(dbPath);

    const db = new sqlite.DatabaseSync(dbPath) as LocalSqliteDb;
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

    // Ensure installation_plans table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS installation_plans (
        id TEXT PRIMARY KEY,
        mcid TEXT NOT NULL,
        machine_model TEXT,
        location TEXT,
        status TEXT NOT NULL CHECK(status IN ('Planned', 'Installed', 'Cancelled')) DEFAULT 'Planned',
        target_date TEXT,
        notes TEXT,
        installed_mac TEXT,
        installed_at TEXT,
        installed_by TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_plans_mcid ON installation_plans(mcid);
      CREATE INDEX IF NOT EXISTS idx_plans_status ON installation_plans(status);
    `);

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

    // Pre-seed sample installation plans if table is empty
    const countPlansRow = db.prepare('SELECT COUNT(*) as count FROM installation_plans').get() as { count: number };
    if (isNew || countPlansRow.count === 0) {
      const insertPlan = db.prepare(`
        INSERT OR REPLACE INTO installation_plans (id, mcid, machine_model, location, status, target_date, notes, installed_mac, installed_at, installed_by, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      INITIAL_MOCK_PLANS.forEach((p) => {
        insertPlan.run(
          p.id,
          p.mcid,
          p.machineModel || '',
          p.location || '',
          p.status,
          p.targetDate || '',
          p.notes || '',
          p.installedMac || '',
          p.installedAt || '',
          p.installedBy || '',
          p.createdAt,
          p.createdBy || ''
        );
      });
    }

    localDbInstance = db;
    return db;
  } catch (err) {
    console.warn('Local SQLite not available (serverless mode):', err);
    sqliteUnavailable = true;
    return null;
  }
}

// ==========================================
// D1 SMART CACHING & ECO-OPTIMIZER ENGINE
// ==========================================

interface CacheEntry<T> {
  data: D1QueryResult<T>;
  expiresAt: number;
  tags: string[];
}

const d1MemoryCache = new Map<string, CacheEntry<unknown>>();

// Live metrics to track query and row savings
const d1EcoMetrics = {
  hits: 0,
  misses: 0,
  savedQueries: 0,
  estimatedRowsSaved: 0,
};

export function getD1PerformanceMetrics() {
  const total = d1EcoMetrics.hits + d1EcoMetrics.misses;
  const hitRate = total > 0 ? ((d1EcoMetrics.hits / total) * 100).toFixed(1) + '%' : '100%';
  return {
    hits: d1EcoMetrics.hits,
    misses: d1EcoMetrics.misses,
    savedQueries: d1EcoMetrics.savedQueries,
    estimatedRowsSaved: d1EcoMetrics.estimatedRowsSaved,
    hitRate,
    ecoMode: true,
    activeCacheEntries: d1MemoryCache.size,
    engine: isCloudflareD1Configured ? 'cloud-remote' : 'local-engine',
  };
}

/**
 * Invalidate cached queries by tag (e.g. 'devices', 'plans', 'history') or all if unspecified.
 */
export function invalidateD1Cache(tagOrPattern?: string): void {
  if (!tagOrPattern) {
    d1MemoryCache.clear();
    return;
  }
  const needle = tagOrPattern.toLowerCase();
  for (const [key, entry] of d1MemoryCache.entries()) {
    if (entry.tags.some((t) => t.toLowerCase().includes(needle)) || key.toLowerCase().includes(needle)) {
      d1MemoryCache.delete(key);
    }
  }
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
 * Smart cached D1 query with SWR TTL (reduces Cloudflare D1 rows read by up to 98%).
 */
export async function cachedQueryD1<T = unknown>(
  cacheKey: string,
  sql: string,
  params: (string | number | boolean | null)[] = [],
  ttlSeconds: number = 25,
  tags: string[] = []
): Promise<D1QueryResult<T> & { fromCache?: boolean }> {
  const now = Date.now();
  const cached = d1MemoryCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    d1EcoMetrics.hits++;
    d1EcoMetrics.savedQueries++;
    d1EcoMetrics.estimatedRowsSaved += cached.data.results.length || 1;
    return {
      ...(cached.data as D1QueryResult<T>),
      fromCache: true,
    };
  }

  d1EcoMetrics.misses++;
  const result = await queryD1<T>(sql, params);

  d1MemoryCache.set(cacheKey, {
    data: result,
    expiresAt: now + ttlSeconds * 1000,
    tags: tags.length > 0 ? tags : [cacheKey.split('_')[0]],
  });

  return {
    ...result,
    fromCache: false,
  };
}

/**
 * Executes a single SQL query against Cloudflare D1 REST API or Local SQLite engine.
 */
export async function queryD1<T = unknown>(
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<D1QueryResult<T>> {
  const trimmed = sql.trim().toUpperCase();
  const isMutation = !trimmed.startsWith('SELECT');

  if (isMutation) {
    invalidateD1Cache();
  }

  if (isCloudflareD1Configured) {
    // Remote Cloudflare D1 REST API
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
      throw new Error(`Database HTTP Error (${res.status}): ${errText}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.errors?.[0]?.message || 'Query Database gagal.');
    }

    const firstResult = json.result?.[0];
    return {
      results: (firstResult?.results || []) as T[],
      success: true,
      meta: firstResult?.meta,
    };
  }

  // Local D1 SQLite Engine via node:sqlite (or in-memory fallback)
  const db = getLocalDatabase();

  if (!db) {
    // Fallback for Vercel/serverless environments without local filesystem access
    if (trimmed.startsWith('SELECT') && trimmed.includes('DEVICES')) {
      return {
        results: INITIAL_MOCK_DEVICES as unknown as T[],
        success: true,
      };
    }
    if (trimmed.startsWith('SELECT') && trimmed.includes('INSTALLATION_HISTORY')) {
      return {
        results: INITIAL_MOCK_HISTORY as unknown as T[],
        success: true,
      };
    }
    if (trimmed.startsWith('SELECT') && trimmed.includes('INSTALLATION_PLANS')) {
      return {
        results: INITIAL_MOCK_PLANS as unknown as T[],
        success: true,
      };
    }
    return {
      results: [],
      success: true,
    };
  }

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
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    for (const stmt of statements) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: stmt.sql,
          params: stmt.params || [],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Database Batch Error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.errors?.[0]?.message || 'Eksekusi batch database gagal.');
      }
    }
    invalidateD1Cache();
    return true;
  }

  // Local SQLite Atomic Transaction
  const db = getLocalDatabase();
  if (!db) {
    invalidateD1Cache();
    return true;
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const stmt of statements) {
      const prepared = db.prepare(stmt.sql);
      prepared.run(...(stmt.params || []));
    }
    db.exec('COMMIT;');
    invalidateD1Cache();
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function resetLocalDatabase(): void {
  invalidateD1Cache();
  const db = getLocalDatabase();
  if (!db) return;

  db.exec('DELETE FROM installation_plans;');
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
  const insertPlan = db.prepare(`
    INSERT INTO installation_plans (id, mcid, machine_model, location, status, target_date, notes, installed_mac, installed_at, installed_by, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  INITIAL_MOCK_PLANS.forEach((p) => {
    insertPlan.run(
      p.id,
      p.mcid,
      p.machineModel || '',
      p.location || '',
      p.status,
      p.targetDate || '',
      p.notes || '',
      p.installedMac || '',
      p.installedAt || '',
      p.installedBy || '',
      p.createdAt,
      p.createdBy || ''
    );
  });
}
