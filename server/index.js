import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcrypt';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { desc, eq, sql } from 'drizzle-orm';
import { db, pool, migrateDb } from './db/index.js';
import { users, auditLog } from './db/schema.js';
import { lanOnly } from './lib/lan.js';
import { ROLES, isRole, requireLogin, requireModule } from './lib/auth.js';
import { audit } from './lib/audit.js';

for (const key of ['DATABASE_URL', 'SESSION_SECRET'])
  if (!process.env[key]) throw new Error(`Missing ${key} in server/.env`);

await migrateDb();

const app = express();
app.set('trust proxy', 'loopback'); // behind Caddy, req.ip = the real client
app.use(lanOnly); // keep first: nothing is served outside the LAN
app.use(express.json());
const PgStore = connectPgSimple(session);
app.use(session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // idle timeout: maxAge restarts on every request
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 2 * 60 * 60 * 1000 },
}));

app.get('/api/health', async (req, res) => {
  await db.execute(sql`select 1`);
  res.json({ ok: true, db: true, ip: req.ip });
});

// ---- auth ----
const me = (req) => ({ ...req.session.user, modules: ROLES[req.session.user.role] ?? [] });

// ponytail: in-memory lockout, cleared on restart; fine for one server PC
const fails = new Map(); // username -> { n, until }
app.post('/api/login', async (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const f = fails.get(username);
  if (f?.until > Date.now()) return res.status(429).json({ error: 'Too many failed logins. Wait 5 minutes.' });

  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) {
    const n = (f?.n ?? 0) + 1;
    fails.set(username, n >= 5 ? { n: 0, until: Date.now() + 5 * 60_000 } : { n });
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  fails.delete(username);
  await new Promise((ok, fail) => req.session.regenerate((err) => (err ? fail(err) : ok())));
  req.session.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
  await audit(db, user.id, 'login', 'users', user.id, null, { ip: req.ip });
  res.json(me(req));
});

app.get('/api/me', requireLogin, (req, res) => res.json(me(req)));

app.post('/api/logout', requireLogin, async (req, res, next) => {
  await audit(db, req.session.user.id, 'logout', 'users', req.session.user.id);
  req.session.destroy((err) => (err ? next(err) : res.json({ ok: true })));
});

// ---- admin: users + audit log ----
app.get('/api/users', requireModule('admin'), async (req, res) => {
  const list = await db
    .select({ id: users.id, username: users.username, fullName: users.fullName, role: users.role, active: users.active })
    .from(users)
    .orderBy(users.username);
  res.json({ users: list, roles: Object.keys(ROLES) });
});

app.post('/api/users', requireModule('admin'), async (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const fullName = String(req.body?.fullName ?? '').trim();
  const role = req.body?.role;
  const password = String(req.body?.password ?? '');
  if (!username || !fullName || !isRole(role) || password.length < 8)
    return res.status(400).json({ error: 'Username, full name, role and a password of 8+ characters are required' });

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(users).values({ username, fullName, role, passwordHash }).returning({ id: users.id });
    await audit(tx, req.session.user.id, 'create', 'users', row.id, null, { username, fullName, role });
    return row;
  });
  res.status(201).json(created);
});

app.get('/api/audit', requireModule('admin'), async (req, res) => {
  res.json(await db
    .select({ id: auditLog.id, at: auditLog.at, user: users.username, action: auditLog.action, tableName: auditLog.tableName, rowId: auditLog.rowId })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .orderBy(desc(auditLog.id))
    .limit(50));
});

// ---- built client (one port for everything) ----
const dist = fileURLToPath(new URL('../client/dist', import.meta.url));
app.use(express.static(dist));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((req, res) =>
  existsSync(dist) ? res.sendFile('index.html', { root: dist }) : res.status(404).send('Client not built. Run "npm run build" in client/.'));

app.use((err, req, res, next) => {
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Bad request' });
  const e = err.cause ?? err; // drizzle's own message embeds query params (personal data): log the pg cause only
  if (e.code === '23505') return res.status(409).json({ error: 'Already exists' });
  console.error(e.stack ?? e);
  res.status(500).json({ error: 'Server error' });
});

const { HOST = '0.0.0.0', PORT = 3000 } = process.env;
app.listen(PORT, HOST, (err) => {
  if (err) throw err;
  console.log(`Barangay system on http://${HOST}:${PORT}`);
});
