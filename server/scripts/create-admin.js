// Create an admin account: npm run create-admin
import { createInterface } from 'node:readline';
import bcrypt from 'bcrypt';
import { db, pool, migrateDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { audit } from '../lib/audit.js';

const lines = createInterface({ input: process.stdin })[Symbol.asyncIterator]();
const ask = async (q) => { process.stdout.write(q); return String((await lines.next()).value ?? ''); };

const username = (await ask('Username: ')).trim().toLowerCase();
const fullName = (await ask('Full name: ')).trim();
const password = await ask('Password (8+ characters): '); // ponytail: echoes while typing; fine for one-time setup
if (!username || !fullName || password.length < 8) {
  console.error('All fields are required and the password needs 8+ characters.');
  process.exit(1);
}

try {
  await migrateDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(users)
      .values({ username, fullName, role: 'admin', passwordHash: await bcrypt.hash(password, 12) })
      .returning({ id: users.id });
    await audit(tx, null, 'create', 'users', row.id, null, { username, fullName, role: 'admin' });
  });
  console.log(`Admin "${username}" created.`);
} catch (err) {
  console.error((err.cause ?? err).message); // not err.message: it embeds the password hash
  process.exitCode = 1;
}
await pool.end();
process.exit();
