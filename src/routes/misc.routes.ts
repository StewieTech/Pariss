import express from 'express';
import { getHistory } from '../controllers/history.controller';
import { setMode, getMode } from '../controllers/mode.controller';

const router = express.Router();

router.get('/history', getHistory);
router.post('/mode', setMode);
router.get('/mode', getMode);

export default router;
