import mongoose from 'mongoose';

let connected: Promise<typeof mongoose> | null = null;

/**
 * Connect mongoose using the same MONGODB_URI/MONGODB_DB environment used by the native driver.
 * This keeps a single source of truth for connection info.
 */
export async function connectMongoose() {
  if (connected) return connected;

  // Fail fast instead of buffering queries for 10s when the connection is down.
  // This makes issues obvious (especially during local dev).
  mongoose.set('bufferCommands', false);

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  // On Windows, `localhost` can resolve to IPv6 (::1). If Mongo is only listening on IPv4,
  // you'll see ECONNREFUSED ::1:27017. Force IPv4 loopback in that case.
  const safeUri = uri.replace('mongodb://localhost', 'mongodb://127.0.0.1');

  const dbName = process.env.MONGODB_DB || 'paris_dev';

  connected = mongoose.connect(safeUri, { dbName });
  return connected;
}
