import mongoose from 'mongoose';

let connected: Promise<typeof mongoose> | null = null;

/**
 * Connect mongoose using the same MONGODB_URI/MONGODB_DB environment used by the native driver.
 * This keeps a single source of truth for connection info.
 */
export async function connectMongoose() {
  if (connected) return connected;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const dbName = process.env.MONGODB_DB || 'paris_dev';

  connected = mongoose.connect(uri, { dbName });
  return connected;
}
