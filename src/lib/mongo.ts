// src/lib/mongo.ts
import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (client) return client;

  if (!clientPromise) {
    clientPromise = new MongoClient(uri, { maxPoolSize: 5 }).connect();
    console.log('MongoClient connecting...');
  }

  client = await clientPromise;
  return client;
}

export async function getDb() {
  const c = await getMongoClient();
  return c.db(process.env.MONGODB_DB || 'paris_dev');
}
