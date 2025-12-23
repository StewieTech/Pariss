import './config/env';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
// import { connectDb } from './config/db';
import { getMongoClient } from './lib/mongo';
import chatRouter from './routes/chat.routes';
import miscRouter from './routes/misc.routes';
import pvpRouter from './routes/pvp.routes';
import voiceRouter from './routes/voice.routes';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));