import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';
import { getMe, patchProfile, postPhoto } from '../controllers/me.controller';

const router = express.Router();

router.get('/', requireAuth, getMe);
router.patch('/profile', requireAuth, patchProfile);

// Photo upload
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10) || '.jpg';
    const safeExt = /^[.a-z0-9]+$/i.test(ext) ? ext : '.jpg';
    cb(null, `profile_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.post('/photo', requireAuth, upload.single('photo'), postPhoto);

export default router;
