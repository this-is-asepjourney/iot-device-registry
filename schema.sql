-- ========================================================
-- IoT Device Installation Registry - Cloudflare D1 SQLite Schema
-- ========================================================

-- 1. Tabel devices: Menyimpan data mesin dan modul IoT yang terpasang
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

-- 2. Tabel mac_index: Menjamin aturan 1-to-1 (1 MAC hanya boleh aktif di 1 MCID)
CREATE TABLE IF NOT EXISTS mac_index (
  normalized_mac TEXT PRIMARY KEY,
  mcid TEXT NOT NULL,
  mac_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(mcid) REFERENCES devices(mcid)
);

-- 3. Tabel installation_history: Audit log kronologis seluruh siklus hidup
CREATE TABLE IF NOT EXISTS installation_history (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK(event_type IN ('INSTALL', 'REPLACE_DEVICE', 'STATUS_CHANGE', 'REMOVE')),
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

-- Indeks performa tinggi (Eco-indexing untuk mencegah full table scan)
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_updated_at ON devices(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_status_updated ON devices(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mac_index_mcid ON mac_index(mcid);
CREATE INDEX IF NOT EXISTS idx_mac_index_status ON mac_index(status);
CREATE INDEX IF NOT EXISTS idx_history_mcid ON installation_history(mcid);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON installation_history(timestamp DESC);

-- 4. Tabel installation_plans: Rencana / request instalasi modul IoT
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
CREATE INDEX IF NOT EXISTS idx_plans_status_created ON installation_plans(status, created_at DESC);
