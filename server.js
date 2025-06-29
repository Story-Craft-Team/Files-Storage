const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { Op } = require('sequelize');
const sequelize = require('./db');
const File = require('./models/File');

const cloudinary = require('./cloudinary');
const streamifier = require('streamifier');

const app = express();
const PORT = 3000;

// Конфигурация
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
];

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Инициализация
async function initialize() {
  try {
    await sequelize.authenticate();
    
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR);
      console.log('Папка uploads создана');
    }
    
    console.log('Инициализация завершена');
  } catch (err) {
    console.error('Ошибка инициализации:', err);
    process.exit(1);
  }
}

// Настройка Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'), false);
    }
  }
});

// Middleware
app.use(express.json());
app.use('/files', express.static(UPLOAD_DIR));

// Маршруты
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен', details: 'Не получен файл в запросе' });
    }

    console.log('Начало обработки файла:', req.file.originalname);
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isImage = req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'image/svg+xml';
    const isPDF = req.file.mimetype === 'application/pdf';

    let fileName, filePath, dbRecord;

    if (isImage) {
      fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webp`; // уникальное имя
      console.log('Конвертация изображения в WebP...');
      const webpBuffer = await sharp(req.file.buffer).webp({ quality: 80 }).toBuffer();

      console.log('Загрузка в Cloudinary...');
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'files',
            public_id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            resource_type: 'image',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(webpBuffer).pipe(uploadStream);
      });

      // Создаем запись в базе после успешной загрузки
      dbRecord = await File.create({
        name: req.file.originalname,
        path: uploadResult.secure_url,
        size: req.file.size,
        mimetype: 'image/webp',
        originalExtension: ext,
        formatSize: formatFileSize(req.file.size),
      });

    } else if (isPDF) {
      fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
      filePath = path.join(UPLOAD_DIR, fileName);
      console.log('Сохранение PDF файла...');
      fs.writeFileSync(filePath, req.file.buffer);

      // Создаем запись в базе после сохранения файла
      dbRecord = await File.create({
        name: req.file.originalname,
        path: fileName,
        size: req.file.size,
        mimetype: req.file.mimetype,
        originalExtension: ext,
        formatSize: formatFileSize(req.file.size),
      });

    } else {
      return res.status(400).json({ error: 'Недопустимый тип файла' });
    }

    res.status(201).json({
      id: dbRecord.id,
      name: dbRecord.name,
      url: dbRecord.path,
      size: dbRecord.size,
      formatSize: dbRecord.formatSize,
      mimetype: dbRecord.mimetype,
      originalExtension: dbRecord.originalExtension,
    });

  } catch (err) {
    console.error('Полная ошибка загрузки:', {
      message: err.message,
      stack: err.stack,
      file: req.file ? { name: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : null,
    });

    res.status(500).json({
      error: 'Ошибка загрузки файла',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});


app.get('/files', async (req, res) => {
  try {
    const files = await File.findAll({
      attributes: ['id', 'name', 'size', 'mimetype', 'createdAt', 'originalExtension'],
      order: [['createdAt', 'DESC']]
    });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения списка файлов' });
  }
});

app.get('/files/:id', async (req, res) => {
  try {
    const file = await File.findByPk(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    const filePath = path.join(UPLOAD_DIR, file.path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден на диске' });
    }

    res.type(file.mimetype);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения файла' });
  }
});

app.delete('/files/:id', async (req, res) => {
  try {
    const file = await File.findByPk(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    const filePath = path.join(UPLOAD_DIR, file.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await file.destroy();
    res.json({ message: 'Файл успешно удалён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// Запуск сервера
initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log(`Папка загрузок: ${UPLOAD_DIR}`);
  });
});