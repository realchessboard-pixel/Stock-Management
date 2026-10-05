#!/usr/bin/env node
/**
 * StockFlow Local — run StockFlow on a shop PC with only Node.js installed.
 *
 *   node local/stockflow.mjs setup       first-time setup (database, build, config)
 *   node local/stockflow.mjs start       run StockFlow (database + app, auto-restart, nightly backups)
 *   node local/stockflow.mjs remote      give it a public https:// address via Tailscale Funnel
 *   node local/stockflow.mjs backup      make a backup now
 *   node local/stockflow.mjs restore <file>   restore a backup (StockFlow must be stopped)
 *   node local/stockflow.mjs autostart on|off  start automatically when the computer starts
 *
 * The database is PostgreSQL bundled via the `embedded-postgres` package — nothing to install.
 * All data lives in one folder: STOCKFLOW_HOME (default: ./stockflow-data).
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGunzip, createGzip } from "node:zlib";
import readline from "node:readline";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = path.resolve(process.env.STOCKFLOW_HOME || path.join(APP_DIR, "stockflow-data"));
const DIRS = { db: path.join(HOME, "database"), uploads: path.join(HOME, "uploads"), backups: path.join(HOME, "backups"), logs: path.join(HOME, "logs") };
const CONFIG_FILE = path.join(HOME, "config.json");
const DB_NAME = "stockflow";
const KEEP_BACKUPS = 14;

// ───────────────────────────── helpers ─────────────────────────────

const log = (...a) => console.log(`[${new Date().toLocaleTimeString("en-IN")}]`, ...a);
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 9)) fail(`Node.js 20.9 or newer is needed (you have ${process.versions.node}). Install the LTS version from https://nodejs.org`);
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

function saveConfig(cfg) {
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

function dbUrl(cfg) {
  return `postgresql://stockflow:${encodeURIComponent(cfg.dbPassword)}@127.0.0.1:${cfg.dbPort}/${DB_NAME}`;
}

function appEnv(cfg) {
  return {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    DATABASE_URL: dbUrl(cfg),
    SESSION_SECRET: cfg.sessionSecret,
    UPLOAD_DIR: DIRS.uploads,
    PORT: String(cfg.port),
    HOSTNAME: cfg.host,
    ...(cfg.publicUrl ? { PUBLIC_URL: cfg.publicUrl, APP_URL: cfg.publicUrl } : {}),
  };
}

function runNode(script, args, env, opts = {}) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: APP_DIR, env, stdio: opts.quiet ? "pipe" : "inherit", encoding: "utf8" });
  if (r.status !== 0) {
    if (opts.quiet) console.error(r.stdout, r.stderr);
    fail(opts.error ?? `Command failed: ${path.basename(script)} ${args.join(" ")}`);
  }
  return r;
}

const prismaCli = () => path.join(APP_DIR, "node_modules", "prisma", "build", "index.js");
const nextCli = () => path.join(APP_DIR, "node_modules", "next", "dist", "bin", "next");

async function openDb(cfg) {
  let EmbeddedPostgres;
  try {
    ({ default: EmbeddedPostgres } = await import("embedded-postgres"));
  } catch {
    fail("The bundled database is missing. Run setup again (it installs it).");
  }
  const pg = new EmbeddedPostgres({
    databaseDir: DIRS.db,
    port: cfg.dbPort,
    user: "stockflow",
    password: cfg.dbPassword,
    persistent: true,
    createPostgresUser: os.userInfo().uid === 0, // Linux servers running as root
    onLog: () => {},
    onError: (e) => fs.appendFileSync(path.join(DIRS.logs, "database.log"), `${new Date().toISOString()} ${String(e)}\n`),
  });
  return pg;
}

async function ensureDatabase(pg) {
  const client = pg.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
  await client.end();
  if (!rowCount) await pg.createDatabase(DB_NAME);
}

function migrate(cfg) {
  log("Applying database updates…");
  runNode(prismaCli(), ["migrate", "deploy"], appEnv(cfg), { quiet: true, error: "Database update failed. See the message above." });
}

// ───────────────────────────── backup / restore ─────────────────────────────

/** Consistent snapshot of every table (one REPEATABLE READ transaction), gzipped JSON lines. */
async function backup(pg, reason = "manual") {
  fs.mkdirSync(DIRS.backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(DIRS.backups, `stockflow-${stamp}.jsonl.gz`);
  const client = pg.getPgClient(DB_NAME, "127.0.0.1");
  await client.connect();
  const gz = createGzip();
  const out = fs.createWriteStream(file, { mode: 0o600 });
  gz.pipe(out);
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const { rows: tables } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename",
    );
    const { rows: mig } = await client.query("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name");
    gz.write(JSON.stringify({ format: "stockflow-backup", version: 1, createdAt: new Date().toISOString(), reason, migrations: mig.map((m) => m.migration_name) }) + "\n");
    for (const { tablename } of tables) {
      const { rows } = await client.query(`SELECT row_to_json(t) AS r FROM "${tablename}" t`);
      for (let i = 0; i < rows.length; i += 1000) {
        gz.write(JSON.stringify({ table: tablename, rows: rows.slice(i, i + 1000).map((x) => x.r) }) + "\n");
      }
    }
    await client.query("COMMIT");
  } finally {
    await client.end();
    gz.end();
    await new Promise((r) => out.on("close", r));
  }
  // Photos: mirror new files into backups/uploads (they never change once written).
  if (fs.existsSync(DIRS.uploads)) fs.cpSync(DIRS.uploads, path.join(DIRS.backups, "uploads"), { recursive: true, force: false, errorOnExist: false });
  // Keep the newest KEEP_BACKUPS files.
  const all = fs.readdirSync(DIRS.backups).filter((f) => f.endsWith(".jsonl.gz")).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) fs.rmSync(path.join(DIRS.backups, old));
  // Optional second copy, e.g. a USB drive or a Google Drive / OneDrive synced folder.
  const cfg = loadConfig();
  if (cfg?.extraBackupDir) {
    try {
      fs.mkdirSync(cfg.extraBackupDir, { recursive: true });
      fs.copyFileSync(file, path.join(cfg.extraBackupDir, path.basename(file)));
    } catch (e) {
      log(`⚠ Could not copy backup to ${cfg.extraBackupDir}: ${e.message}`);
    }
  }
  return file;
}

async function restore(pg, cfg, file) {
  if (!fs.existsSync(file)) fail(`Backup not found: ${file}`);
  let header = null;
  const client = pg.getPgClient(DB_NAME, "127.0.0.1");
  await client.connect();
  try {
    await client.query("BEGIN");
    // Disable FK checks and append-only triggers for the load (superuser only).
    await client.query("SET LOCAL session_replication_role = replica");
    const { rows: tables } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'");
    await client.query(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
    let count = 0;
    // Create the reader right before iterating: lines emitted earlier (while we awaited
    // the queries above) would otherwise be lost and the loop would wait forever.
    const lines = readline.createInterface({ input: fs.createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      const rec = JSON.parse(line);
      if (!header) {
        if (rec.format !== "stockflow-backup") throw new Error("This is not a StockFlow backup file.");
        header = rec;
        continue;
      }
      if (!rec.rows.length || !tables.some((t) => t.tablename === rec.table)) continue;
      // Only columns present in the backup: newer columns (added by later updates) keep their defaults.
      const cols = Object.keys(rec.rows[0]).map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
      await client.query(`INSERT INTO "${rec.table}" (${cols}) SELECT ${cols} FROM json_populate_recordset(NULL::"${rec.table}", $1::json)`, [JSON.stringify(rec.rows)]);
      count += rec.rows.length;
    }
    await client.query("COMMIT");
    log(`Restored ${count} records from ${path.basename(file)} (made ${header?.createdAt}).`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    fail(`Restore failed, nothing was changed: ${e.message}`);
  } finally {
    await client.end();
  }
  const photos = path.join(path.dirname(file), "uploads");
  if (fs.existsSync(photos)) fs.cpSync(photos, DIRS.uploads, { recursive: true, force: false, errorOnExist: false });
}

function lastBackupAgeHours() {
  if (!fs.existsSync(DIRS.backups)) return Infinity;
  const files = fs.readdirSync(DIRS.backups).filter((f) => f.endsWith(".jsonl.gz"));
  if (!files.length) return Infinity;
  const newest = Math.max(...files.map((f) => fs.statSync(path.join(DIRS.backups, f)).mtimeMs));
  return (Date.now() - newest) / 3_600_000;
}

// ───────────────────────────── commands ─────────────────────────────

async function setup() {
  checkNode();
  for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
  let cfg = loadConfig();
  if (!cfg) {
    cfg = {
      port: 3000,
      host: "127.0.0.1",
      dbPort: 5433,
      dbPassword: randomBytes(18).toString("base64url"),
      sessionSecret: randomBytes(48).toString("base64url"),
      publicUrl: null,
      extraBackupDir: null,
    };
    saveConfig(cfg);
    log(`Created settings in ${CONFIG_FILE}`);
  }
  const pg = await openDb(cfg);
  if (!fs.existsSync(path.join(DIRS.db, "PG_VERSION"))) {
    log("Creating the database (first time only)…");
    await pg.initialise().catch((e) => fail(`Could not create the database: ${e.message}\n  Tip: put StockFlow in a normal folder you own (e.g. Documents), not a system or temp folder.`));
  }
  await pg.start();
  try {
    await ensureDatabase(pg);
    migrate(cfg);
  } finally {
    await pg.stop();
  }
  log("Building the app (takes a few minutes the first time)…");
  runNode(nextCli(), ["build"], { ...appEnv(cfg), NODE_OPTIONS: "--max-old-space-size=2048" }, { error: "Build failed. Make sure you ran `npm ci` first." });
  console.log(`
✔ StockFlow is set up.

  Start it:   node local/stockflow.mjs start     (Windows: double-click "Start StockFlow.bat")
  Then open:  http://localhost:${cfg.port}  on this computer and create your shop.

  For phones (camera scanning) and access from anywhere:  node local/stockflow.mjs remote
  Data folder (back this up!):  ${HOME}
`);
}

async function start() {
  checkNode();
  const cfg = loadConfig();
  if (!cfg) fail("StockFlow is not set up yet. Run: node local/stockflow.mjs setup");
  if (!fs.existsSync(path.join(APP_DIR, ".next", "BUILD_ID"))) fail("The app is not built. Run setup again.");
  for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });

  const pg = await openDb(cfg);
  log("Starting database…");
  try {
    await pg.start();
  } catch (e) {
    fail(`The database could not start (${e.message}). Is StockFlow already running in another window?`);
  }
  await ensureDatabase(pg);
  migrate(cfg);

  let app = null;
  let stopping = false;
  let restarts = 0;
  const appLog = fs.createWriteStream(path.join(DIRS.logs, "app.log"), { flags: "a" });

  const launch = () => {
    app = spawn(process.execPath, [nextCli(), "start", "-p", String(cfg.port), "-H", cfg.host], { cwd: APP_DIR, env: appEnv(cfg), stdio: ["ignore", "pipe", "pipe"] });
    app.stdout.on("data", (d) => appLog.write(d));
    app.stderr.on("data", (d) => appLog.write(d));
    app.on("exit", (code) => {
      if (stopping) return;
      restarts++;
      const wait = Math.min(30, 2 ** Math.min(restarts, 5));
      log(`⚠ App stopped (code ${code}). Restarting in ${wait}s… (details in ${path.join(DIRS.logs, "app.log")})`);
      setTimeout(launch, wait * 1000);
    });
  };
  launch();

  // Wait until healthy, then print where to open it.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${cfg.port}/api/health`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  restarts = 0;
  console.log(`
✔ StockFlow is running.
   On this computer:  http://localhost:${cfg.port}
   ${cfg.publicUrl ? `On phones / anywhere:  ${cfg.publicUrl}` : "For phones: run `node local/stockflow.mjs remote` once."}
   Keep this window open. Press Ctrl+C to stop.
`);

  // Nightly backups: check every hour, back up if the last one is older than 20 hours.
  const backupIfDue = async () => {
    if (lastBackupAgeHours() < 20) return;
    try {
      const f = await backup(pg, "automatic");
      log(`Backup saved: ${path.basename(f)}`);
    } catch (e) {
      log(`⚠ Backup failed: ${e.message}`);
    }
  };
  setTimeout(backupIfDue, 60_000);
  setInterval(backupIfDue, 3_600_000);

  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    log("Stopping StockFlow…");
    app?.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1500));
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function tailscaleBin() {
  const candidates = process.platform === "win32"
    ? ["tailscale", "C:\\Program Files\\Tailscale\\tailscale.exe"]
    : ["tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale", "/usr/bin/tailscale", "/usr/local/bin/tailscale"];
  for (const c of candidates) {
    const r = spawnSync(c, ["version"], { encoding: "utf8" });
    if (r.status === 0) return c;
  }
  return null;
}

/** Public https:// address through Tailscale Funnel: free, no domain, phones install nothing. */
async function remote() {
  const cfg = loadConfig();
  if (!cfg) fail("Run setup first.");
  const ts = tailscaleBin();
  if (!ts) {
    fail(`Tailscale is not installed on this computer.
  1. Install it from https://tailscale.com/download and sign in (free).
  2. Run this command again.`);
  }
  const status = spawnSync(ts, ["status", "--json"], { encoding: "utf8" });
  if (status.status !== 0) fail("Tailscale is installed but not signed in. Open Tailscale, sign in, then run this again.");
  const dns = JSON.parse(status.stdout)?.Self?.DNSName?.replace(/\.$/, "");
  if (!dns) fail("Could not read this computer's Tailscale name.");
  log("Turning on Tailscale Funnel (a browser window may ask you to approve it once)…");
  const r = spawnSync(ts, ["funnel", "--bg", String(cfg.port)], { stdio: "inherit" });
  if (r.status !== 0) fail("Tailscale Funnel could not be turned on. Follow the link it printed to enable HTTPS and Funnel for your account, then run this again.");
  cfg.publicUrl = `https://${dns}`;
  saveConfig(cfg);
  console.log(`
✔ StockFlow is reachable at:  ${cfg.publicUrl}

  Open this address on your phones (camera scanning and "Install app" work here).
  Restart StockFlow once so it knows its new address.
`);
}

function autostart(mode) {
  const on = mode !== "off";
  const node = process.execPath;
  const script = path.join(APP_DIR, "local", "stockflow.mjs");
  if (process.platform === "win32") {
    const startup = path.join(process.env.APPDATA ?? "", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
    const vbs = path.join(startup, "StockFlow.vbs");
    if (!on) return fs.rmSync(vbs, { force: true }), log("Autostart turned off.");
    // .vbs runs StockFlow minimised without a console window popping up at login.
    fs.writeFileSync(vbs, `Set sh = CreateObject("WScript.Shell")\r\nsh.CurrentDirectory = "${APP_DIR}"\r\nsh.Run """${node}"" ""${script}"" start", 7, False\r\n`);
    return log(`Autostart on: StockFlow will start when you log in to Windows (${vbs}).`);
  }
  if (process.platform === "darwin") {
    const plist = path.join(os.homedir(), "Library", "LaunchAgents", "in.stockflow.local.plist");
    if (!on) return spawnSync("launchctl", ["unload", plist]), fs.rmSync(plist, { force: true }), log("Autostart turned off.");
    fs.mkdirSync(path.dirname(plist), { recursive: true });
    fs.writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>in.stockflow.local</string>
  <key>ProgramArguments</key><array><string>${node}</string><string>${script}</string><string>start</string></array>
  <key>WorkingDirectory</key><string>${APP_DIR}</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${path.join(DIRS.logs, "launcher.log")}</string>
  <key>StandardErrorPath</key><string>${path.join(DIRS.logs, "launcher.log")}</string>
</dict></plist>`);
    spawnSync("launchctl", ["load", plist]);
    return log("Autostart on (macOS login item).");
  }
  const unit = path.join(os.homedir(), ".config", "systemd", "user", "stockflow.service");
  if (!on) return spawnSync("systemctl", ["--user", "disable", "--now", "stockflow"]), fs.rmSync(unit, { force: true }), log("Autostart turned off.");
  fs.mkdirSync(path.dirname(unit), { recursive: true });
  fs.writeFileSync(unit, `[Unit]\nDescription=StockFlow\nAfter=network-online.target\n\n[Service]\nWorkingDirectory=${APP_DIR}\nExecStart=${node} ${script} start\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n`);
  spawnSync("systemctl", ["--user", "daemon-reload"]);
  spawnSync("systemctl", ["--user", "enable", "--now", "stockflow"], { stdio: "inherit" });
  log("Autostart on (systemd user service). To run even when nobody is logged in: sudo loginctl enable-linger $USER");
}

// ───────────────────────────── main ─────────────────────────────

const [cmd, arg] = process.argv.slice(2);
const withDb = async (fn) => {
  const cfg = loadConfig();
  if (!cfg) fail("Run setup first.");
  const pg = await openDb(cfg);
  try {
    await pg.start();
  } catch {
    fail("The database is in use. Stop StockFlow first (close its window or press Ctrl+C).");
  }
  try {
    await ensureDatabase(pg);
    await fn(pg, cfg);
  } finally {
    await pg.stop();
  }
};

switch (cmd) {
  case "setup":
    await setup();
    break;
  case "start":
    await start();
    break;
  case "remote":
    await remote();
    break;
  case "backup": {
    // Works while StockFlow is running (uses the live database) or stopped (starts it briefly).
    const cfg = loadConfig();
    if (!cfg) fail("Run setup first.");
    const { default: pgLib } = await import("pg");
    const running = { getPgClient: (database) => new pgLib.Client({ host: "127.0.0.1", port: cfg.dbPort, user: "stockflow", password: cfg.dbPassword, database }) };
    const probe = running.getPgClient(DB_NAME);
    const isRunning = await probe.connect().then(() => probe.end().then(() => true), () => false);
    if (isRunning) log(`Backup saved: ${await backup(running)}`);
    else await withDb(async (pg) => log(`Backup saved: ${await backup(pg)}`));
    break;
  }
  case "restore":
    if (!arg) fail("Which backup? Example: node local/stockflow.mjs restore stockflow-data/backups/stockflow-2026-10-05T21-00-00.jsonl.gz");
    await withDb(async (pg, cfg) => {
      migrate(cfg);
      await restore(pg, cfg, path.resolve(arg));
    });
    break;
  case "autostart":
    autostart(arg);
    break;
  default:
    console.log("Usage: node local/stockflow.mjs <setup|start|remote|backup|restore <file>|autostart on|off>");
}
