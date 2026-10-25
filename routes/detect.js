#!/usr/bin/env node

const multer  = require('multer');
const express = require('express');
const mime    = require('mime-types');

const router  = express.Router();

const { detectImage } = require('../lib/detect');

const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const type = mime.lookup(file.originalname) || file.mimetype;
        if (type && type.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
});

router.post('/detect', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: false, message: 'No image uploaded!' });
        }

        const detectedMime = mime.lookup(req.file.originalname) || req.file.mimetype;

        const result = await detectImage(
            req.file.buffer,
            req.file.originalname,
            detectedMime
        );

        return res.json({ status: true, data: result });
    } catch (error) {
        if (error.message === 'Only image files are allowed!') {
            return res.status(400).json({ status: false, message: error.message });
        }

        return res.status(500).json({ status: false, message: error.message });
    }
});

module.exports = router;
