const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const safe = uuidv4() + ext;
    cb(null, safe);
  },
});

function fileFilter(_req, file, cb) {
  const knownTextMimetypes = [
    'text/plain',
    'application/octet-stream', // sometimes sent for text fields
  ];

  // Allow if it's a known text/form mimetype
  if (knownTextMimetypes.includes(file.mimetype)) return cb(null, true);

  // Allow PDFs
  if (file.mimetype === 'application/pdf') return cb(null, true);

  // Reject everything else (images, docx, etc.)
  cb(new Error('Only PDF files are accepted'), false);
}

const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '5');

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
});

module.exports = { upload, uploadDir };
