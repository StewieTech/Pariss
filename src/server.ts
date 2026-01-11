import './config/env';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import path from 'path';
// import { connectDb } from './config/db';
import { getMongoClient } from './lib/mongo';
import { ensureIndexes } from './lib/ensureIndexes';
import chatRouter from './routes/chat.routes';
import miscRouter from './routes/misc.routes';
import pvpRouter from './routes/pvp.routes';
import voiceRouter from './routes/voice.routes';
import authRouter from './routes/auth.routes';
import meRouter from './routes/me.routes';
import { connectMongoose } from './lib/mongoose';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Mongoose is only used for the User/profile model right now.
// PvP rooms/messages continue to use the native MongoDB driver.
connectMongoose().catch((e: unknown) => {
  logger.warn({ err: String((e as any)?.message || e) }, 'connectMongoose failed');
});

// Serve uploaded profile photos
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Ensure Mongo indexes at startup (safe to call multiple times)
ensureIndexes().catch((e) => {
  logger.warn({ err: String((e as any)?.message || e) }, 'ensureIndexes failed');
});

app.get('/_health', async (_req, res) => {
  try {
    // optional: ping DB to confirm connectivity
    await (await getMongoClient()).db(process.env.MONGODB_DB || 'paris_dev').command({ ping: 1 });
    res.json({ status: 'ok', db: 'ok' });
  } catch (e: any) {
    res.json({ status: 'ok', db: 'down', error: String(e?.message || e) });
  }
});

app.use('/chat', chatRouter);
app.use('/chat', voiceRouter);
app.use('/pvp', pvpRouter);
app.use('/api/v1', miscRouter);

// Auth/profile
app.use('/auth', authRouter);
app.use('/me', meRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));