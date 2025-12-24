import express from 'express';
import { createRoom, joinRoom, postMessage, getRoomState, suggestReplies, listRooms } from '../controllers/pvp.controller';

const router = express.Router();

router.post('/create', createRoom);
router.get('/rooms', listRooms);
router.post('/:id/join', joinRoom);
router.post('/:id/message', postMessage);
router.get('/:id', getRoomState);
router.post('/:id/suggest', suggestReplies);

export default router;
