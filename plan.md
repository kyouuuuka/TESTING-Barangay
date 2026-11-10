# Build Plan — Barangay Management System

From empty repo to a running system at the barangay hall. Follows the build order in [CLAUDE.md](CLAUDE.md), broken into tasks.

**How to use**
- Work top to bottom. Each step ends with **Done when**. All checks pass before the next step.
- Tick `[ ]` boxes as you go. Answers to open questions go in [Decisions](#decisions).
- With Claude Code: one step (or sub-step) per session, e.g. "do Step 3 migration script".

---

## Old system findings

From `C:\Users\Migoy\Documents\barangay`. Table headers and file names only. No records were read.

- **`data/` is the live folder.** It matches CLAUDE.md: `census2023` has 14,466 rows and `cedula` has 19,339. Other history in it: `cashonhand` (cashbook) 3,096, `rcoll` (OR collections) 4,952, `vdatabase` (COMELEC voters) 4,926. Root `garbage.DBF` holds 14,079 Garbage ID numbers.
- **Empty in `data/`:** `blotter`, `cdv`/`cdvdet` (vouchers), `jv`, `inventory`, `official` (ORs), `brgyforms` (certificate log). `brgy201` has 1 row. Nothing to migrate for these, so build them fresh. `data1/` and `data2/` hold some old ORs and vouchers (archive only).
- **`user.dbf`** has per-user module flags (`ISCENSUS ISCTC ISOR ISKAT ISID ISBRGY201 ISCDV ISCHART ISAPPRO ISREPORT ISBU ISRES`…). Use them to define roles. It has 112 rows with plain-text passwords, so it is not migrated.
- **`brgyforms.dbf` columns** list every extra field certificates use: business name, location and type, new/renewal, closing date, CTC no/date/place, OR no, 4Ps no, transfer-to, cohabitation partners and date, blotter no and date, deceased and date died, PWD no, number of children, number of trees, TODA vehicle (make, motor, chassis, plate), income, title no, free-for-senior, care-of. Use them as the source for `certificate_types.required_fields`.
- **`cedula.dbf`** keeps its own copy of name, address, sex, citizenship, POB, DOB and civil status, plus **height, weight**, profession, three income lines (`GROSS1/2`, `SAL1/2`, `REAL1/2`, likely amount + tax each), interest, total and treasurer.
- **`census2023`** has `RELHEAD` (relation to household head). CLAUDE.md `residents` has no such column. Columns `B`, `J–M` and `R–AN` are unnamed. Civil status, POB, religion, blood type, citizenship, PWD/4Ps/solo-parent/OSY flags, precinct, structure, ownership and years residing are not among the named columns, so they are probably in the unnamed ones.
- **Accounts:** `chart.dbf` (152 rows: code, description, fund, group, appropriation, monthly amounts) looks like the real chart of accounts. `accntlist.dbf` (31 rows: name + code) looks like the OR collection item list.
- **Old menus and forms include modules CLAUDE.md lacks:** Garbage ID, Business Plates, resident Barangay ID cards, Barangay Inhabitants report (RBI), statistics by street/ownership/structure/religion/4Ps, check writing, EWT alphalist.
- **Reference material:**
  - certificate look: `doc/*.jpg|pdf`
  - Word sources: `docSTACRUZ/*.doc`
  - seals and logos: `GRAPHICS/` (`Ph_seal_bulacan_santamaria.png`…)
  - ID design: `GRAPHICS/barangay id card.jpg`
  - print layouts: `REPORTS/*.frx`
  - screen logic: `forms/*.scx` (code lives in the `.sct` files)
  - fonts: `FONTS/`

## Rules for every step

- **Money:** `numeric(12,2)`. Sum in SQL. Never do float math on money in JS.
- **Dates:** Postgres `date`, handled as `'YYYY-MM-DD'` strings (Drizzle `date()` string mode). Server and Postgres timezone: `Asia/Manila`.
- **Audit:** every create, update and delete, plus login, logout and reprint, writes `audit_log` in the **same transaction**. `before`/`after` hold changed fields only.
- **Issued documents** (certificates, cedulas, ORs, vouchers) are **never deleted**. They get `void` + reason instead. Each one stores a **snapshot** of what was printed (name, address, civil status…), so a reprint matches the original after the resident record changes.
- **Numbers:** OR and CTC numbers come from pre-printed booklets. The system suggests the next number and the DB enforces `UNIQUE`. Control numbers (certificate, blotter, DV, JV) run per year and are `UNIQUE`.
- **Validation:** DB constraints first (`NOT NULL`, `UNIQUE`, `CHECK`, FKs). Short checks in routes give friendly messages. No validation library.
- **Privacy (RA 10173):**
  - No personal data in git or logs: DBFs, `uploads/`, dumps, migration reports and `.env` are gitignored.
  - Error logs hold message + stack only, never request bodies.
  - Photos and signatures are served only to logged-in users.
  - Keep DBF copies and the dev database out of cloud-synced folders (OneDrive, Google Drive).
- **Offline-safe:** no CDN at runtime. Fonts and images are self-hosted. The app must work with the internet down.
- Lists paginate server-side. One commit per finished task. `npm test` (server) must pass before each commit.

## Dependencies (entire project)

| Where | Package | Why |
|---|---|---|
| server | `express` (v5) | HTTP. v5 passes async errors to the error handler. |
| server | `express-session`, `connect-pg-simple` | Sessions live in Postgres. The default MemoryStore leaks memory and logs everyone out on restart. |
| server | `bcrypt` | Password hashes. If the native install fails on Windows, use `bcryptjs` (same hashes). |
| server | `pg`, `drizzle-orm`, `drizzle-kit` (dev) | DB access + migrations. |
| server | `dbffile` | One-time DBF import. |
| client | `react`, `react-dom`, `react-router-dom`, `vite`, `tailwindcss`, `@tailwindcss/vite` | UI. |

**Skip these. A built-in already covers each one:**
- `dotenv` → `node --env-file` / `process.loadEnvFile()`
- `nodemon` → `node --watch`
- jest/vitest → `node --test`
- `multer` → `express.raw()` for images
- `axios` → `fetch`
- IP-range lib → `net.BlockList`
- chart lib → tables + CSS bars
- PDF lib → print CSS
- date picker → `<input type="date">`
- modal lib → `<dialog>`
- state/query libs → `useState` + a small `api()` wrapper

Add a new package only when none of the above can do the job, and log it in Decisions.

## Target layout

```
client/
  src/App.jsx           routes + menu filtered by role
  src/api.js            fetch wrapper (JSON, 401 → login)
  src/pages/<module>/   screens
  src/print/            print-only pages (letterhead, CTC, OR, reports, IDs)
  public/img/  public/fonts/
server/
  index.js              middleware, routes, serves client/dist
  db/schema.js          all tables (split only when it hurts)
  db/index.js           pg Pool → drizzle
  lib/lan.js  lib/auth.js (roles)  lib/audit.js
  routes/<module>.js
  scripts/              migrate-dbf.js, create-admin.js, seed-certificates.js, check-cedula.js, backup.ps1
  drizzle/              generated migrations (committed)
  uploads/              photos, signatures (gitignored)
```

---

## Step 0 — Prep (no code)

- [x] Install PostgreSQL 17 + pgAdmin on the dev laptop (`server/scripts/setup-postgres.ps1` does this step and the next two; reuse it on the server PC).
- [x] Localhost only: `listen_addresses = 'localhost'` (set via `ALTER SYSTEM`). `pg_hba.conf` already allows only `127.0.0.1/32` and `::1/128`. Restart the service.
- [x] Create an app role. Don't run the app as superuser `postgres`:
  ```sql
  CREATE ROLE brgy_app LOGIN PASSWORD '...';
  CREATE DATABASE brgy OWNER brgy_app;
  ```
  `DATABASE_URL=postgres://brgy_app:...@localhost:5432/brgy`
- [ ] Copy old `data/` to a work folder (e.g. `C:\brgy-old\data`). Scripts read the copy, never the live folder.
- [ ] Sit with the secretary and treasurer. Collect:
  - the census Excel with the real headers for `census2023` (check `data/census.xls` and `census1.xls` first)
  - one real printout of every certificate type, the fee for each type, and the paper size (A4 / letter / long)
  - a blank CTC form and a blank OR (AF 51), and whether they print on them or write by hand
  - letterhead, seals, signatories, and the current OR and CTC booklet numbers
  - keep or drop for each extra old module (see findings)
- [x] `.gitignore`: `node_modules/ .env dist/ uploads/ server/scripts/out/ *.dbf *.dump *.7z`
- [ ] Private remote repo.

**Done when:** pgAdmin connects to `brgy` as `brgy_app`. Decisions 1–6 each have an answer or someone assigned to answer it.

## Step 1 — Scaffold + health check

- [x] Client: Vite + React + Tailwind, written by hand (no template demo files). Add `react-router-dom` when the second page lands.
- [x] `vite.config.js`: `server: { proxy: { '/api': 'http://127.0.0.1:3000' } }`.
- [x] In `server/`: `"type": "module"`, server deps installed. Scripts:
  ```json
  "dev":   "node --watch --env-file=.env index.js",
  "start": "node --env-file=.env index.js",
  "test":  "node --test",
  "db:generate": "drizzle-kit generate",
  "create-admin": "node --env-file=.env scripts/create-admin.js"
  ```
- [x] `server/.env` (never committed) and `server/.env.example` (keys only): `DATABASE_URL SESSION_SECRET HOST PORT`. Add `OLD_DATA_DIR` in Step 3.
- [x] `db/index.js` and `drizzle.config.js`. `generate` needs no DB connection, so the config loads no env.
- [x] On start, apply pending migrations with `migrate()` from `drizzle-orm/node-postgres/migrator`. The server PC then needs no manual migrate step.
- [x] `GET /api/health` runs `select 1` and returns `{ ok: true, db: true, ip }`.
- [x] Serve `client/dist` with an SPA fallback: unknown `/api/*` → 404 JSON, everything else → `index.html`. Express 5 has no `'*'` route, so use a final `app.use`.
- [x] Error handler logs only the pg `cause` (drizzle's own error message embeds query params, i.e. personal data) and returns `{ error }`. Duplicate key → 409.
- [x] Listen on `HOST:PORT`: dev `0.0.0.0:3000`, prod `127.0.0.1:3000` behind Caddy.

**Done when:** `npm run dev` in both folders shows "API ok" on the page. After `npm run build`, a phone on the same Wi-Fi opens `http://<laptop-ip>:3000`. For this test, allow port 3000 on the Private profile in Windows Firewall.

## Step 2 — Auth, roles, LAN lock, audit log

Tables: `users`, `audit_log`, `settings` (key/value), `session` (auto-created by connect-pg-simple).

- [x] `lib/lan.js`: a `net.BlockList` used as an allow list: `127.0.0.0/8`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`. It is the first middleware; anything else gets 403. Set `app.set('trust proxy', 'loopback')` so `req.ip` is the real client behind Caddy.
- [x] Sessions: `connect-pg-simple` with `createTableIfMissing`. Cookie `httpOnly`, `sameSite: 'lax'`, `secure` in prod, `rolling` idle timeout (~2 h). Call `req.session.regenerate()` on login. SameSite cookies plus a JSON-only API cover CSRF, so no CSRF library.
- [x] Routes: `POST /api/login`, `POST /api/logout`, `GET /api/me`. bcrypt cost 12. After 5 failed logins on a username, lock it for 5 min (in-memory `Map`).
- [ ] `POST /api/me/password` (users change their own password).
- [x] `lib/auth.js` holds one `ROLES` object mapping role → modules, based on the old `user.dbf` flags. Start with:
  - `admin`: all
  - `secretary`: residents, certificates, blotter, officials, reports
  - `treasurer`: cedula, receipts, accounting, procurement, inventory, reports
  - `encoder`: residents

  `requireModule('cedula')` guards routes. `/api/me` returns the user's modules so the menu hides the rest.
- [x] `lib/audit.js`: `audit(tx, userId, action, tableName, rowId, before, after)`. Add `diff()` (changed keys only) with the first update route.
- [x] `scripts/create-admin.js` asks for a username and password (`node:readline`) and inserts the first admin.
- [ ] Admin pages:
  - **Users:** list + add done, plus an audit log view. Still to do: set role, reset password, disable. Staff accounts are needed from Step 4 on.
  - **Settings:** barangay, municipality, province, punong barangay, secretary, treasurer.
- [x] Tests: the allow list (`192.168.1.5` ✓, `::ffff:192.168.1.5` ✓, `8.8.8.8` ✗). Test `diff()` once it exists.

**Done when:**
- Login and logout work.
- A 6th wrong password is refused.
- `password_hash` starts with `$2b$`.
- `audit_log` has login and user-create rows.
- Tests pass.

## Step 3 — Core schema + DBF migration

Tables: `sitios`, `households`, `residents`, `cedulas`, `accounts`, `appropriations` (with the [schema deltas](#schema-deltas-vs-claudemd)).

- [ ] Map `census2023` columns `B`, `J–M` and `R–AN` from the Excel headers. Write the mapping as a comment block at the top of `migrate-dbf.js`. If there is no Excel, count distinct values per column (counts only, no names) and confirm with the census encoder.
- [ ] `scripts/migrate-dbf.js` reads `OLD_DATA_DIR` and runs in one transaction. It refuses to run if `residents` already has rows (`--reset` is for dev only). Load order:
  1. `sitios` ← `sitio.dbf` (29 rows). Report `census2023.STREET` values that are not in it.
  2. `accounts` ← per Decision 2. `appropriations` ← `chart.APROP` for the current year.
  3. `residents` ← `census2023`. Trim text and keep the old `ID` as `legacy_id`. A bad or missing DOB becomes `NULL` and goes in the report.
  4. `households` ← each `RELHEAD = HEAD` row starts a household and the rows after it join that household. Check this order rule on 3 streets with staff.
  5. `cedulas` ← `cedula.dbf`. Set `resident_id` from `cedula.ID = census ID` if that link holds, else from an exact name + DOB match, else `NULL` (the snapshot keeps the name).
- [ ] Set the `dbffile` encoding to the DBF code page. Check that names with `Ñ/ñ` survive.
- [ ] Write reports to `server/scripts/out/` (gitignored): duplicates (normalized name + DOB), bad DOBs, unmatched streets, unlinked cedulas, and source vs inserted counts.
- [ ] Not migrated:
  - `user.dbf` and the parish tables
  - `data1/` and `data2/`
  - OR and cashbook history (Step 7 starts from opening balances)
  - old censuses (`census1`, `book2`, `bsc`, `balagtas`, `dummy`)
  - old photos

  The old folder becomes a read-only archive.

**Done when:**
- A fresh DB loads in minutes.
- Counts reconcile: 14,466 residents and 19,339 cedulas, minus listed rejects.
- Staff have reviewed the duplicates report.
- 20 random residents match the old screens.

## Step 4 — Residents & Households

- [ ] API: search, get, create, update.
  - Search uses `ILIKE` on name, with filters for sitio, flags and status, and is paginated.
  - Search ignores Ñ vs N (`unaccent` extension).
  - 14k rows is small. Add `pg_trgm` only if search takes over 300 ms.
- [ ] Never delete residents. Use `status` = active / moved_out / deceased. Counts use active only.
- [ ] Warn about a possible duplicate on create (same name + DOB).
- [ ] Compute age and senior (≥ 60) from DOB at query time (Decision 7).
- [ ] Household page: members with relation to head, change head, move a member, new household.
- [ ] Photo and signature:
  - Capture: webcam (`getUserMedia`) or file pick for photos; a signature drawn on `<canvas>` or a scanned one.
  - Upload: `PUT /api/residents/:id/photo` with `express.raw({ type: ['image/jpeg', 'image/png'], limit: '2mb' })`. Check the magic bytes and save as `uploads/residents/<id>-photo.jpg`.
  - Serve files through an auth-checked route.
  - The webcam needs HTTPS on other PCs (Step 10). It works on `localhost` now.
- [ ] One generic printable table page serves every list: RBI by household, seniors, PWD, 4Ps, solo parents, OSY, and counts by sitio/religion/structure/ownership.

**Done when:**
- The encoder finds any resident by partial name.
- The encoder adds a family as a household with photos and prints the senior list.
- Each edit shows in `audit_log`.

## Step 5 — Certificates, Cedula, Official Receipts, daily collections

**5a. Print base**
- [ ] Copy seals and logos from `GRAPHICS/` to `client/public/img/`. Copy certificate fonts from `FONTS/` to `public/fonts/` (check the license).
- [ ] Print pages live under `/print/...` and call `window.print()` after load. Each document sets `@page { size; margin }`. App chrome gets `print:hidden`.
- [ ] Letterhead component: Republic / province / municipality / barangay + seals. Signatories come from `settings`.

**5b. Certificates**
- [ ] `scripts/seed-certificates.js` fills `certificate_types`: code, name, fee, template, and `required_fields` (`[{ key, label, type }]`, taken from `brgyforms.dbf`).
- [ ] A template is HTML with `{{key}}` placeholders. Rendering is one `replace()` with HTML-escaped values. Built-in placeholders: name, age, sex, civil status, address, sitio, purpose, control no, date in words ("10th day of November, 2026"), CTC no/date/place, OR no/amount.
- [ ] Convert every type listed in CLAUDE.md, one at a time. `doc/*.jpg|pdf` is the visual reference. Compare the printouts side by side.
- [ ] Issue flow:
  1. Pick resident, then certificate type.
  2. Fill the extra fields (purpose via `<datalist>`).
  3. Fee, one of:
     - create an OR in the same transaction
     - link an OR the treasurer already issued
     - waive the fee with a reason (senior/indigent, old `FREESC`)
  4. Save the snapshot in `extra`.
  5. Print.
- [ ] Reprint (audited) and void with reason. Admin can edit template text with a live preview, so wording changes need no developer. The old system had the same in Utilities → Modify Report.

**5c. Cedula (CTC)**
- [ ] The form mirrors the individual CTC: snapshot fields, height, weight, profession, three income lines (business gross receipts, salary/profession, real property), basic tax, interest, total.
- [ ] Put the math in one pure function, `computeCedula(input, dateIssued)`. The law: ₱5 basic + ₱1 per ₱1,000 income, additional tax capped at ₱5,000, interest if paid late (LGC Sec. 157–161). **Confirm the exact rules with the treasurer and against the old form code (`forms/cedula`, `forms/ctc*`).**
- [ ] `scripts/check-cedula.js` recomputes all 19,339 migrated cedulas and prints the mismatch count + cedula IDs (no names). Explain every mismatch as either a data error or a rule difference. Add a few hand cases in `node --test`.
- [ ] Print onto the pre-printed CTC form. Fields are positioned in mm, with an x/y offset stored per PC in `localStorage` because printers drift.
- [ ] Book no + CTC no. The next number is suggested. `UNIQUE`.

**5d. Official receipts + daily collection**
- [ ] `receipts` + `receipt_lines` (account, amount). The next OR in the current booklet is suggested. `UNIQUE(or_no)`. Void with reason; voided ORs are still listed, marked VOID.
- [ ] Print on AF 51 the same way as the CTC, if Decision 5 says print.
- [ ] Daily collection report by date and collector: every OR including voids, totals per account, plus CTC collections. Match the old RCD layouts (`forms/rcdor`, `forms/rcdctc`, `REPORTS/scd*`) and what the municipal treasurer expects.

**Done when:**
- Every certificate type issues end-to-end and matches its old printout.
- Every `check-cedula` mismatch is explained.
- The daily report total equals the sum of valid ORs.
- Voids show correctly.

## Step 6 — Blotter (Katarungang Pambarangay)

- [ ] `blotters` + `blotter_parties` (role, optional `resident_id`, name/age/sex snapshot). Entry no per year. Add logbook book/page fields if they still keep the paper logbook.
- [ ] Status: filed → mediation → conciliation → settled / certified to file action / dismissed. `action_taken` holds notes; history comes from `audit_log`.
- [ ] Patawag (summons) prints through the certificate engine using blotter fields.
- [ ] Sensitive data: secretary and admin only.
- [ ] Monthly KP report: counts by status and violation (replaces old KP Monitoring).

**Done when:** a case with a complainant and a respondent is recorded, its patawag is printed, it is moved to settled, and the report counts it.

## Step 7 — Accounting

- [ ] Appropriations per year per account.
- [ ] Disbursement vouchers + lines:
  - Fields: DV no (per year), payee, TIN, particulars, check no, bank, fund, gross, EWT, VAT.
  - `net` is a generated column (`gross - ewt - vat`).
  - Status: draft → approved → paid / cancelled.
  - DV print (layout from `REPORTS/dv*`, `REPORTS/cdv*`).
- [ ] Journal entries + lines. Saving is refused unless Σdebit = Σcredit (checked in the transaction, with a test).
- [ ] An opening-balances JV on go-live date (cash per fund, from the old cashbook). No history import.
- [ ] Reports are SQL queries, not tables: RAO, SAOB, cash disbursements book per fund, cash receipts book, cashbook. Use the generic print page and match the old layouts (`forms/rao`, `forms/saob`, `REPORTS/cdb*`, `REPORTS/cb`).
- [ ] Only if kept (Decision 3): check writing, EWT alphalist.

**Done when:** a past month of real DVs entered in the new system gives RAO/SAOB totals equal to the old system's printout for that month.

## Step 8 — Procurement, Inventory, Officials 201, IDs

- [ ] Purchase request + items. Quotations are rows (the old system stored 3 suppliers as columns). The abstract of canvass picks the lowest, then the PO. Add AIR/RIS only if staff use them. All of these print.
- [ ] Inventory: property no, description, custodian, cost, current value, status, location. A list plus a per-custodian print.
- [ ] Officials 201: optional `resident_id`, position, term, gov IDs (SSS, TIN, Pag-IBIG, PhilHealth, voter's), photo, signature, emergency contact. Current officials replace the signatory names in `settings`.
- [ ] IDs:
  - Size CR80 (85.6 × 54 mm), front and back, designed from `GRAPHICS/barangay id card.jpg`.
  - Print on an A4 sheet of cards (2 × 5 fits) to cut and laminate, or use `@page` CR80 for a card printer (Decision 9).
  - Resident IDs only if that module is kept.
  - A barcode only if they scan IDs: a self-hosted Code 39 font, no library.

**Done when:** a PR → canvass → PO prints, an official's ID prints at true card size, and certificate signatories come from officials.

## Step 9 — Dashboard

- [ ] Population by sitio, sex and age group. Seniors, PWD, 4Ps, solo parents. Collections per month for the last 12 months. Tables + CSS bars.
- [ ] Admin tile: "last backup" (newest file in the backup folder). A backup that fails silently is the real disaster.

**Done when:** every number equals a direct SQL count.

## Step 10 — Deploy at the barangay

**10a. Server PC + network**
- [ ] Hardware: SSD, ≥ 8 GB RAM, UPS. BIOS: power on after an outage.
- [ ] Windows: never sleep, update active hours set, timezone Asia/Manila, network profile Private.
- [ ] Router: DHCP reservation for `192.168.1.10`, no port forwarding, guest Wi-Fi separate with client isolation.
- [ ] Postgres set up as in Step 0. From another PC, `Test-NetConnection 192.168.1.10 -Port 5432` must return `TcpTestSucceeded: False`.

**10b. App + Caddy**
- [ ] Install the app:
  1. Clone the repo.
  2. Run `npm ci` in both folders, then `npm run build` in `client/`.
  3. Create `server/.env` with `HOST=127.0.0.1`.
- [ ] Run as services with NSSM (auto-start, restart on crash):
  - `brgy-app`: `node --env-file=.env index.js`, app directory `server\`
  - `caddy`: `caddy run --config C:\caddy\Caddyfile`, env `XDG_DATA_HOME=C:\caddy\data`
- [ ] Start `brgy-app` once to create the tables, then run `node scripts/create-admin.js`.
- [ ] `Caddyfile`:
  ```
  192.168.1.10 {
  	tls internal
  	reverse_proxy 127.0.0.1:3000
  }
  ```
- [ ] Import Caddy's root CA (`C:\caddy\data\caddy\pki\authorities\local\root.crt`) into Trusted Root on each staff PC. That gives HTTPS without warnings, and the webcam works.
- [ ] Firewall: `New-NetFirewallRule -DisplayName "Barangay app" -Direction Inbound -Protocol TCP -LocalPort 80,443 -RemoteAddress LocalSubnet -Action Allow`. No rule for 3000 or 5432.

**10c. Backups**
- [ ] `scripts/backup.ps1`:
  - Input: `pg_dump -Fc` + `server\uploads\` + `C:\caddy\data`.
  - Encryption: 7-Zip AES-256 (`7z a -mhe=on -p...`), written to a USB drive.
  - DB password: from `pgpass.conf`.
  - Keep 30 days.
- [ ] Task Scheduler: daily after office hours, set to run whether the user is logged on or not.
- [ ] Offsite: two USB drives swapped weekly; one goes home with a designated official. The archive password is kept sealed with the punong barangay.
- [ ] Monthly restore drill: restore into `brgy_restore_test` and compare row counts. A backup that was never restored is not a backup.
- [ ] Connect the UPS by USB (HID). Windows sees it as a battery; set the critical battery action to shut down.

**10d. Go-live**
- [ ] Day 1 of the parallel month: run `migrate-dbf.js` on a fresh copy of `data/`. From then on, every transaction goes into **both** systems. Never re-run the migration.
- [ ] Daily during the parallel month: compare collection total, certificates issued and cedulas issued. Fix every difference.
- [ ] Switch over on the 1st of the following month, so no report straddles two systems. Zip the old folder as a read-only archive.
- [ ] Train each role with a one-page cheat sheet. Change the admin password. Review users and roles. Turn on screen lock on staff PCs.
- [ ] Update routine: backup → `git pull` (or USB copy) → `npm ci` → build client → restart `brgy-app`.

**Done when:**
- A week passes with no manual restarts.
- The power-pull test passes: UPS → clean shutdown → power back → app comes up on its own.
- The restore drill passes.

---

## Schema deltas vs CLAUDE.md

| Table | Change | Why |
|---|---|---|
| `residents` | + `relation_to_head`, `status` (active / moved_out / deceased), `legacy_id` | old `RELHEAD`; residents are never deleted; trace each row back to its census record |
| `residents` | `is_senior` computed from `dob`, not stored (Decision 7) | stored age flags go stale |
| `cedulas` | + snapshot (name, address, sex, citizenship, POB, DOB, civil status), `height`, `weight`, tax per income line, `void`, `void_reason`; `resident_id` nullable | mirrors old `cedula.dbf` and the CTC form; some old rows have no resident match |
| `certificates`, `receipts`, `vouchers` | + `void_reason`, `voided_by`, `voided_at` | issued documents are never deleted |
| `vouchers` | `net` as a generated column | can't disagree with gross/EWT/VAT |
| `users` | + `active` | disable a user without deleting audit history |
| new `settings` | key/value: barangay identity, signatories | letterhead works before Officials exists |
| new `session` | created by connect-pg-simple | sessions survive restarts |

## Decisions

| # | Question | Default until answered | Answer |
|---|---|---|---|
| 1 | Meaning of `census2023` columns `B`, `J–M`, `R–AN` | none, blocks Step 3 | |
| 2 | Accounts source | `chart.dbf` = chart of accounts; `accntlist.dbf` = OR items | |
| 3 | Keep Garbage ID, Business Plates, resident Barangay ID, check writing, EWT alphalist, AIR/RIS? | drop until staff ask | |
| 4 | Business registry table, or business info in certificate `extra`? | `extra` | |
| 5 | CTC / OR: print on pre-printed forms, or handwrite + encode? | print | |
| 6 | Paper size per certificate | from old printouts | |
| 7 | Senior/age flags computed or stored? | computed from DOB | |
| 8 | Cedula basic/additional/interest rules | old form code + treasurer | |
| 9 | IDs: paper + laminate, or card printer? | paper | |
| 10 | Roles and their modules | 4 roles in Step 2 | |
| 11 | `voter_precinct` from `vdatabase.dbf` (exact name match)? | skip | |
| 12 | OR/voucher history in `data1/`, `data2/` needed? | archive only | |
