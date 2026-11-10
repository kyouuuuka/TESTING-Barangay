import { auditLog } from '../db/schema.js';

// Call with the same `tx` as the change so both commit or neither does.
// Never put passwords or hashes in before/after.
// ponytail: before/after stored as given; add a changed-fields diff when the first update route lands.
export const audit = (tx, userId, action, tableName, rowId = null, before = null, after = null) =>
  tx.insert(auditLog).values({ userId, action, tableName, rowId, before, after });
