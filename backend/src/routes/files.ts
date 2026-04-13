import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadFile } from '../services/storage.js';
import { config } from '../config/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxSizeBytes },
  fileFilter: (_req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// POST /api/files/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const { url, key } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

  res.status(201).json({
    filename: req.file.originalname,
    url,
    key,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
});

export default router;
