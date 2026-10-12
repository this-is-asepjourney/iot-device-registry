import fs from 'node:fs';
import path from 'node:path';

// Parse .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
}

const accountId = env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = env.CLOUDFLARE_D1_DATABASE_ID;
const apiToken = env.CLOUDFLARE_API_TOKEN;

console.log('--- CLOUDFLARE D1 MIGRATION RUNNER ---');
console.log(`Account ID  : ${accountId}`);
console.log(`Database ID : ${databaseId}`);
console.log(`API Token   : ${apiToken ? '✓ Found (' + apiToken.slice(0, 10) + '...)' : '✗ Missing'}`);

if (!accountId || !databaseId || !apiToken) {
  console.error('Error: Kredensial Cloudflare D1 belum lengkap di .env.local');
  process.exit(1);
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

async function executeQuery(sql, params = []) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`D1 Query Error: ${JSON.stringify(data.errors || data)}`);
  }
  return data.result?.[0] || { results: [] };
}

async function runMigration() {
  try {
    console.log('\n[1/4] Memeriksa koneksi database Cloudflare D1...');
    const ping = await executeQuery('SELECT 1 as connected;');
    console.log('✓ Terhubung ke Cloudflare D1!');

    console.log('\n[2/4] Menerapkan schema.sql ke Cloudflare D1...');
    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'schema.sql'), 'utf-8');

    // Remove comments and split into individual statements
    const cleanSql = schemaSql.replace(/--.*$/gm, '').trim();
    const statements = cleanSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      if (!stmt) continue;
      console.log(`  Menjalankan: ${stmt.slice(0, 50).replace(/\s+/g, ' ')}...`);
      await executeQuery(stmt);
    }
    console.log('✓ Seluruh tabel dan indeks berhasil dibuat di Cloudflare D1!');

    console.log('\n[3/4] Memeriksa apakah data awal perlu di-seed...');
    const countRes = await executeQuery('SELECT COUNT(*) as count FROM devices;');
    const currentCount = countRes.results?.[0]?.count || 0;
    console.log(`  Jumlah devices saat ini: ${currentCount}`);

    if (currentCount === 0) {
      console.log('  Memasukkan data sampel awal mesin industri ke Cloudflare D1...');
      const sampleDevices = [
        {
          mcid: 'CNC-VF2-01',
          mac_address: 'B8:27:EB:4A:88:11',
          normalized_mac: 'B827EB4A8811',
          machine_model: 'Haas CNC Milling VF-2',
          location: 'Plant 1 - Machining Workshop Line A',
          status: 'Installed',
          installed_at: '2026-09-15T08:30:00.000Z',
          updated_at: '2026-09-15T08:30:00.000Z',
          notes: 'Gateway IoT sensor getaran dan temperatur spindle.',
          last_technician: 'asepjourney551@gmail.com',
        },
        {
          mcid: 'PRESS-50T-02',
          mac_address: 'DC:A6:32:1B:90:34',
          normalized_mac: 'DCA6321B9034',
          machine_model: 'Aida 50 Ton Hydraulic Press',
          location: 'Plant 1 - Stamping Section Line C',
          status: 'Installed',
          installed_at: '2026-09-20T10:15:00.000Z',
          updated_at: '2026-09-20T10:15:00.000Z',
          notes: 'Sensor stroke counter dan hidrolik pressure transmitter.',
          last_technician: 'asepjourney551@gmail.com',
        },
        {
          mcid: 'ROBOT-WELD-03',
          mac_address: 'E4:5F:01:8C:7D:92',
          normalized_mac: 'E45F018C7D92',
          machine_model: 'Fanuc Arc Mate 100iD',
          location: 'Plant 2 - Robotic Welding Bay 4',
          status: 'Maintenance',
          installed_at: '2026-08-10T13:45:00.000Z',
          updated_at: '2026-10-01T09:00:00.000Z',
          notes: 'Dalam pengecekan berkala konektivitas Modbus TCP.',
          last_technician: 'asepjourney551@gmail.com',
        },
      ];

      for (const d of sampleDevices) {
        await executeQuery(
          `INSERT INTO devices (mcid, mac_address, normalized_mac, machine_model, location, status, installed_at, updated_at, notes, last_technician)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d.mcid,
            d.mac_address,
            d.normalized_mac,
            d.machine_model,
            d.location,
            d.status,
            d.installed_at,
            d.updated_at,
            d.notes,
            d.last_technician,
          ]
        );
        await executeQuery(
          `INSERT INTO mac_index (normalized_mac, mcid, mac_address, status, updated_at)
           VALUES (?, ?, ?, 'active', ?)`,
          [d.normalized_mac, d.mcid, d.mac_address, d.installed_at]
        );
      }

      // History log
      const sampleHistory = [
        {
          id: 'hist-init-01',
          event_type: 'INSTALL',
          mcid: 'CNC-VF2-01',
          mac_address: 'B8:27:EB:4A:88:11',
          new_status: 'Installed',
          machine_model: 'Haas CNC Milling VF-2',
          location: 'Plant 1 - Machining Workshop Line A',
          notes: 'Instalasi awal IoT vibration unit.',
          timestamp: '2026-09-15T08:30:00.000Z',
          performed_by: 'asepjourney551@gmail.com',
        },
        {
          id: 'hist-init-02',
          event_type: 'INSTALL',
          mcid: 'PRESS-50T-02',
          mac_address: 'DC:A6:32:1B:90:34',
          new_status: 'Installed',
          machine_model: 'Aida 50 Ton Hydraulic Press',
          location: 'Plant 1 - Stamping Section Line C',
          notes: 'Instalasi awal IoT pressure sensor.',
          timestamp: '2026-09-20T10:15:00.000Z',
          performed_by: 'asepjourney551@gmail.com',
        },
        {
          id: 'hist-init-03',
          event_type: 'STATUS_CHANGE',
          mcid: 'ROBOT-WELD-03',
          mac_address: 'E4:5F:01:8C:7D:92',
          previous_status: 'Installed',
          new_status: 'Maintenance',
          machine_model: 'Fanuc Arc Mate 100iD',
          location: 'Plant 2 - Robotic Welding Bay 4',
          notes: 'Pemeliharaan sensor berkala jadwal Q4.',
          timestamp: '2026-10-01T09:00:00.000Z',
          performed_by: 'asepjourney551@gmail.com',
        },
      ];

      for (const h of sampleHistory) {
        await executeQuery(
          `INSERT INTO installation_history (id, event_type, mcid, mac_address, previous_status, new_status, machine_model, location, notes, timestamp, performed_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            h.id,
            h.event_type,
            h.mcid,
            h.mac_address,
            h.previous_status || null,
            h.new_status,
            h.machine_model,
            h.location,
            h.notes,
            h.timestamp,
            h.performed_by,
          ]
        );
      }
      console.log('✓ Data awal berhasil dimasukkan ke Cloudflare D1!');
    } else {
      console.log('✓ Database sudah memiliki data, melewati seeding.');
    }

    console.log('\n[4/4] Verifikasi Tabel dan Data di Cloudflare D1:');
    const tablesRes = await executeQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%';"
    );
    console.log('  Tabel yang terdaftar:', tablesRes.results.map((r) => r.name).join(', '));

    const finalDevices = await executeQuery('SELECT mcid, mac_address, status, machine_model FROM devices;');
    console.log('  Daftar Devices di Cloudflare D1:');
    console.table(finalDevices.results);

    console.log('\n🎉 SUKSES! Database Cloudflare D1 siap digunakan.');
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan saat migrasi Cloudflare D1:', err);
    process.exit(1);
  }
}

runMigration();
