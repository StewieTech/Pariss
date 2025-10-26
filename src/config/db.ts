import mongoose from 'mongoose';

/**
 * Attempt to connect to MongoDB. If the connection fails, log a warning and
 * resolve with null so the server can start in environments where Mongo isn't available.
 * This is intentional for lightweight local frontend development where DB features
 * are not yet implemented.
 */
export async function connectDb(): Promise<mongoose.Connection | null> {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/lola';
  try {
    await mongoose.connect(uri);
    // eslint-disable-next-line no-console
    console.info('MongoDB connected');
    return mongoose.connection;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('MongoDB connection failed; continuing without DB. Error:', err?.message || err);
    return null;
  }
}
