# Run StockFlow on your own computer

StockFlow can run on a computer in your shop — no hosting bill. Your phones reach it from
**anywhere** (inside the shop or outside) through a free secure link.

## What you need

| | Minimum |
|---|---|
| Computer | Any 64-bit PC or laptop: **Windows 10/11**, macOS 12+, or Linux (a Raspberry Pi 4/5 with 4 GB and 64-bit OS also works) |
| Memory / disk | 4 GB RAM, 3 GB free disk |
| Software | **Node.js LTS** (free) — that's all. The database is included. |
| Internet | Normal shop internet (phones connect through it) |

Nothing else to install: no Docker, no separate database.

## 1. Install (one time, ~10 minutes)

1. Install **Node.js LTS** from <https://nodejs.org> (click the big LTS button, then Next → Next → Finish).
2. Download StockFlow: on GitHub open the repository → green **Code** button → **Download ZIP**.
   Unzip it into a normal folder you own, e.g. `Documents\StockFlow` (not Program Files, not Desktop sync folders).
3. **Windows:** double-click **`Setup StockFlow.bat`**.
   **Mac / Linux:** open Terminal in the folder and run `./setup-stockflow.sh`.

Setup creates the database, builds the app and makes StockFlow **start automatically** when you
log in to the computer.

## 2. Start it

- **Windows:** double-click **`Start StockFlow.bat`** (after the next restart it starts by itself).
- Open <http://localhost:3000> on that computer and create your shop.

Keep the StockFlow window open (you can minimise it). Closing it stops StockFlow.

## 3. Use it on phones — from anywhere (free)

Phones need a secure `https://` address for barcode scanning and "Install app".
We use **Tailscale Funnel**: free, no domain to buy, and **phones install nothing**.

1. On the shop computer install **Tailscale** from <https://tailscale.com/download> and sign in
   (Google account is fine).
2. **Windows:** double-click **`Phone Access (Tailscale).bat`**.
   **Mac / Linux:** `node local/stockflow.mjs remote`
   The first time, it shows a link to approve "Funnel" in your Tailscale account — open it and click approve,
   then run it again.
3. It prints your address, like `https://shop-pc.tail1234.ts.net`. **Restart StockFlow once.**
4. On each Android phone open that address in Chrome → log in → tap **Install app**.
   StockFlow now appears on the home screen like a normal app, and works on mobile data too.

Tip: use a strong password for every user — the address is reachable from the internet.

## Backups (automatic)

- Every night StockFlow saves a backup in `stockflow-data/backups` (last 14 days kept).
- **Strongly recommended:** also keep a copy outside the computer. Open `stockflow-data/config.json`
  and set `"extraBackupDir"` to a USB drive or a Google Drive / OneDrive folder, e.g.
  `"extraBackupDir": "G:\\My Drive\\StockFlow Backups"`.
- Backup right now: double-click **`Backup Now.bat`** or run `node local/stockflow.mjs backup`
  (works while StockFlow is running).

### Restore a backup

Stop StockFlow, then:

```
node local/stockflow.mjs restore stockflow-data/backups/stockflow-2026-10-05T21-00-00.jsonl.gz
```

This replaces the current data with the backup. Then start StockFlow again.

### Moving to a new computer

Install as above on the new computer, then copy the old `stockflow-data` folder over the new one.

## Good to know

- **The computer must be on** for phones to work. Set Windows to never sleep while plugged in
  (Settings → System → Power → Sleep: Never). A small UPS protects against power cuts.
- **Internet down?** The shop computer keeps working at <http://localhost:3000>; phones reconnect
  automatically when the internet is back.
- **Updates:** download the new ZIP, unzip over the old folder (keep `stockflow-data`), run Setup again.
  Your data is untouched and the database updates itself.
- If something goes wrong, the details are in `stockflow-data/logs/`. StockFlow restarts itself if it crashes.

## Commands (for the technically curious)

```
node local/stockflow.mjs setup              first-time setup / after updating
node local/stockflow.mjs start              run StockFlow
node local/stockflow.mjs remote             public https:// address via Tailscale Funnel
node local/stockflow.mjs backup             backup now (running or stopped)
node local/stockflow.mjs restore <file>     restore a backup (StockFlow stopped)
node local/stockflow.mjs autostart on|off   start with the computer
```

Data folder: `stockflow-data/` (or set `STOCKFLOW_HOME`). Settings: `stockflow-data/config.json`
(port, public address, extra backup folder).
