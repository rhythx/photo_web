const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Auth & Cookie Parser
const cookieParser = require('cookie-parser');
app.use(cookieParser());

const sharp = require('sharp');
const exifParser = require('exif-parser');

const ADMIN_PASSWORD = 'admin';
const AUTH_COOKIE = 'is_admin';

// Login API
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.cookie(AUTH_COOKIE, 'true', { httpOnly: true });
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// Protect Admin Route BEFORE Static
app.use('/admin', (req, res, next) => {
    if (req.cookies[AUTH_COOKIE] === 'true') {
        next();
    } else {
        res.redirect('/login.html');
    }
});

app.use(express.static('public'));

// Protect API Writes
const requireAuth = (req, res, next) => {
    if (req.cookies[AUTH_COOKIE] === 'true') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Database Path
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure Uploads Directory Exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Helper: Read DB
const readDB = () => {
    if (!fs.existsSync(DB_PATH)) return [];
    const data = fs.readFileSync(DB_PATH);
    try {
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

// Helper: Write DB
const writeDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

// API Endpoints

// GET /api/photos - Get all photos
app.get('/api/photos', (req, res) => {
    const photos = readDB();
    // Sort by newest first
    res.json(photos.reverse());
});

// POST /api/photos - Upload a new photo
app.post('/api/photos', requireAuth, upload.single('photo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { category, title, series } = req.body;
    const tempPath = req.file.path;
    const filename = `opt_${Date.now()}.jpg`; // standardized name
    const outputPath = path.join(UPLOADS_DIR, filename);

    let exif = {};
    try {
        // 1. Extract EXIF
        const buffer = fs.readFileSync(tempPath);
        const parser = exifParser.create(buffer);
        const result = parser.parse();

        // Helper for fraction display logic
        const shutter = result.tags.ExposureTime < 1
            ? `1/${Math.round(1 / result.tags.ExposureTime)}`
            : result.tags.ExposureTime;

        exif = {
            camera: result.tags.Model || 'Unknown',
            lens: result.tags.LensModel || '',
            iso: result.tags.ISO,
            aperture: result.tags.FNumber ? `f/${result.tags.FNumber}` : '',
            shutter: shutter ? `${shutter}s` : '',
            focal: result.tags.FocalLength ? `${result.tags.FocalLength}mm` : ''
        };
    } catch (exifErr) {
        console.warn('EXIF Extraction failed (continuing upload):', exifErr.message);
    }

    try {
        // 2. Optimize Image
        await sharp(tempPath)
            .rotate() // Auto-rotate based on EXIF orientation
            .resize({ width: 2500, withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(outputPath);

        // 3. Cleanup Temp
        fs.unlinkSync(tempPath);

        const newPhoto = {
            id: Date.now().toString(),
            url: `/uploads/${filename}`,
            category: category || 'nature',
            title: title || 'Untitled',
            series: series || '',
            date: new Date().toISOString(),
            exif: exif
        };

        const photos = readDB();
        photos.push(newPhoto);
        writeDB(photos);

        res.status(201).json(newPhoto);

    } catch (err) {
        console.error('Processing Error:', err);
        // If fail, try to fallback to original? 
        // For now, fail hard so user knows.
        res.status(500).json({ error: 'Image processing failed' });
    }
});

// PUT /api/photos/:id - Update photo details
app.put('/api/photos/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { title, category, series } = req.body;

    let photos = readDB();
    const photoIndex = photos.findIndex(p => p.id === id);

    if (photoIndex === -1) {
        return res.status(404).json({ error: 'Photo not found' });
    }

    // Update fields if provided
    if (title !== undefined) photos[photoIndex].title = title;
    if (category !== undefined) photos[photoIndex].category = category;
    if (series !== undefined) photos[photoIndex].series = series;

    writeDB(photos);

    res.json(photos[photoIndex]);
});

// DELETE /api/photos/:id - Delete a photo
app.delete('/api/photos/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    let photos = readDB();
    const photoToDelete = photos.find(p => p.id === id);

    if (!photoToDelete) {
        return res.status(404).json({ error: 'Photo not found' });
    }

    // Remove file from filesystem
    const filePath = path.join(__dirname, 'public', photoToDelete.url);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    photos = photos.filter(p => p.id !== id);
    writeDB(photos);

    res.json({ message: 'Photo deleted successfully' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin Dashboard: http://localhost:${PORT}/admin`);
});
