// src/lib/ensureIndexes.ts
import { getDb } from './mongo';

let ensured = false;

/**
 * Ensure Mongo indexes exist. Safe to call multiple times; runs once per process.
 * For Lambda, this will run per cold start.
 */
export async function ensureIndexes() {
  if (ensured) return;
  ensured = true;

  const db = await getDb();

  // Rooms: sort by updatedAt descending
  await db.collection('pvp_rooms').createIndex({ updatedAt: -1 });

  // Messages: efficient polling lookup by roomId and ts
  await db.collection('pvp_messages').createIndex({ roomId: 1, ts: 1 });
}
