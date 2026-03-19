import express from 'express';
import { createRoom, joinRoom, postMessage, getRoomState, suggestReplies, listRooms, postVoiceMessage, getAudio, generateVoiceSuggestion, renameRoom } from '../controllers/pvp.controller';

const router = express.Router();

router.post('/create', createRoom);
router.get('/rooms', listRooms);
router.post('/:id/join', joinRoom);
router.post('/:id/message', postMessage);
router.post('/:id/voice-message', postVoiceMessage);
router.post('/:id/voice-suggest', generateVoiceSuggestion);
router.get('/audio/:msgId', getAudio);
router.patch('/:id/rename', renameRoom);
router.get('/:id', getRoomState);
router.post('/:id/suggest', suggestReplies);

export default router;
