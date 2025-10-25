import './config/env';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import { connectDb } from './config/db';
import chatRouter from './routes/chat.routes';
import miscRouter from './routes/misc.routes';
import pvpRouter from './routes/pvp.routes';
import voiceRouter from './routes/voice.routes';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/_health', (req, res) => res.json({ status: 'ok' }));
// app.use('/api/v1/chat', chatRouter);
app.use('/chat', chatRouter);
// voiceRouter provides POST /chat/tts which proxies ElevenLabs TTS via the server-side service
app.use('/chat', voiceRouter);
app.use('/pvp', pvpRouter);
app.use('/api/v1', miscRouter);


const PORT = process.env.PORT || 4000;

connectDb()
  .then(() => {
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('Failed to start', err);
    process.exit(1);
  });
