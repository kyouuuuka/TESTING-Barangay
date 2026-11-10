# Barangay Management System

Web app replacing the old Visual FoxPro desktop program `brgy.exe`.
Runs on one server PC inside the barangay hall. Works ONLY on the barangay Wi-Fi/LAN.

## Old system (reference)
- Location: `C:\Users\Migoy\Documents\barangay`
- Built with Visual FoxPro 6/7 (~2014–2019). Source is available:
  - `data/*.dbf` – tables (data1/, data2/ are older copies)
  - `forms/*.scx` – screens, `REPORTS/*.frx` – printed reports, `MENUS/` – menus
  - `doc/`, `docSTACRUZ/` – Word/PDF certificate templates (~25)
- Key data: `census2023.dbf` (14,466 rows), `cedula.dbf` (19,339 rows), `user.dbf`, `sitio.dbf`, `accntlist.dbf`
- `census2023` has unnamed columns `J`–`AN`. Check the original Excel headers before mapping.
- `user.dbf` stores plain-text passwords. Do NOT migrate them. Users must set new passwords.
- Ignore parish leftovers: baptism, wedding, massintention, confirmation, communion, priest tables.

## Stack
| Layer | Tool |
|---|---|
| Frontend | React + Vite + Tailwind + react-router-dom (`client/`) |
| Backend | Node.js + Express (`server/`), ES modules (`"type": "module"`) |
| Database | PostgreSQL 17, installed locally on the server PC |
| DB access | Drizzle ORM + `pg` |
| Auth | express-session + bcrypt, roles per module |
| Printing | HTML pages with print CSS (`window.print()`), no PDF library |
| File uploads | Folder on server: `server/uploads/` (photos, signatures) |
| Migration | `dbffile` npm package, one-time script in `server/scripts/` |
| Web server | Caddy in front of Express (production) |
| DB viewer | pgAdmin |

NO cloud Supabase. NO cloud services. Everything is local.
Supabase replacements: DB → local Postgres, `supabase.from()` → Express API + `fetch`,
Auth → express-session + bcrypt, Storage → `uploads/` folder.

## How it connects
```
Staff browser (barangay Wi-Fi) → http://192.168.1.10 → Express → PostgreSQL
                                   (server PC)          (same PC, localhost only)
```
- Other PCs never touch the database directly. Only Express does.
- Postgres stays on `localhost` (default). Never open port 5432 to the network.
- Express listens on `0.0.0.0` so LAN devices can reach it.
- Dev: Vite proxies `/api` → `http://localhost:3000`.
- `server/.env`: `DATABASE_URL=postgres://postgres:PASSWORD@localhost:5432/brgy` (never commit).

## Network lock (Wi-Fi only)
1. Router: DHCP reservation gives server a fixed IP (e.g. `192.168.1.10`). NO port forwarding.
2. Windows Firewall on server: allow app port (3000, later 80/443) only from the LAN subnet.
3. Express middleware: reject requests not from `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
4. Login still required. Being on Wi-Fi is not authentication.
5. Visitors on a separate guest Wi-Fi.
6. Remote access (if ever needed): Tailscale/WireGuard. Never expose to internet.

## Modules
Daily use (build first): Residents & Households, Certificates, Cedula (CTC), Official Receipts.
Then: Blotter, Accounting, Procurement, Inventory, Officials 201 + ID printing, Users & Roles, Dashboard.

Certificates to support: barangay clearance, indigency, residency, business clearance/certification,
closed business, cohabitation, solo parent, 4Ps transfer, building/fencing/excavation/wiring/electrical
clearance, late registration, unemployed, medical, non-resident, PAO, SSS calamity, TODA, zoning,
water permit, waste, work, ITR, reconstruction, patawag.

## Database (main tables)
- `residents` – name, suffix, sex, dob, pob, civil_status, citizenship, blood_type, occupation, education,
  religion, contact, photo, signature, household_id, sitio_id, is_pwd, is_senior, is_4ps, is_solo_parent,
  is_osy, voter_precinct, timestamps
- `households` – house_no, street, sitio_id, structure_type, ownership, years_residing, head_resident_id
- `sitios` – name
- `certificate_types` – code, name, template, fee, required_fields (json)
- `certificates` – type_id, resident_id, control_no, purpose, extra (json), receipt_id, issued_at, issued_by
- `cedulas` – resident_id, year, book_no, ctc_no, date_issued, place_issued, profession, basic_tax,
  gross_income, salary, real_property, interest, total, issued_by
- `receipts` + `receipt_lines` – book_no, or_no (unique), payor, resident_id?, date, total, void; account_id, amount
- `blotters` + `blotter_parties` – entry_no, date, time, place, violation, action_taken, status;
  role (complainant/respondent/witness), resident_id?, name, age, sex
- `accounts` – chart of accounts: code, name, type, fund
- `appropriations` – year, account_id, amount
- `vouchers` + `voucher_lines` – dv_no, date, payee, tin, particulars, check_no, bank, fund, gross, ewt, vat, net, status
- `journal_entries` + `journal_lines` – jv_no, date, memo; account_id, debit, credit
- `purchase_requests` + `pr_items` + `quotations`
- `inventory_items` – property_no, description, custodian, cost, current_value, status, location
- `officials` – resident_id?, position, term_start, term_end, gov_ids (json), photo, signature
- `users` – username, password_hash, full_name, role
- `audit_log` – user_id, action, table, row_id, before (json), after (json), at

Rules:
- Each person stored once in `residents`; everything else references it.
- SAOB, RAO, cash disbursement book, cash receipts book = SQL queries over voucher/receipt lines. Not tables.

## Hard rules
- Every create/update/delete writes to `audit_log`.
- Passwords hashed with bcrypt. Never plain text.
- Resident data is personal data (Data Privacy Act, RA 10173). Don't log full records.
- Keep it simple. No extra libraries unless truly needed.

## Build order
1. Scaffold `client/` + `server/`, connect Express to Postgres with Drizzle, `/api/health` route.
2. Auth (sessions, bcrypt, roles), LAN-only middleware, audit log.
3. Migration script: dbf → Postgres (residents, sitios, cedulas, accounts). Report duplicates by name + birthdate.
4. Residents & households: search, add/edit, household view, photo upload.
5. Certificates (convert Word templates to printable HTML on letterhead), Cedula, Official Receipts, daily collection report.
6. Blotter.
7. Accounting: vouchers, JV, appropriations, SAOB/RAO reports.
8. Procurement, inventory, officials 201, ID printing.
9. Dashboard: population by sitio, seniors/PWDs, monthly collections.
10. Deploy at barangay: server PC, Caddy, firewall, nightly encrypted `pg_dump` to USB + offsite copy, UPS.
    Run old and new systems side by side for 1 month before switching.

## Dev setup (Windows)
1. Install PostgreSQL 17 (postgresql.org/download/windows), port 5432, keep pgAdmin.
2. pgAdmin → create database `brgy`.
3. `npm create vite@latest client -- --template react`
4. `server/`: `npm init -y && npm i express pg drizzle-orm dotenv && npm i -D drizzle-kit`
5. Run: `node index.js` in server/, `npm run dev` in client/.
6. Test from phone on same Wi-Fi: `http://<laptop IPv4 from ipconfig>:3000`.
