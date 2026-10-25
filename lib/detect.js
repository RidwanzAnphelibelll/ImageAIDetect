#!/usr/bin/env node

const axios    = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://hivedetect.ai';

const HEADERS = {
    'user-agent':         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'accept':             'application/json, text/plain, */*',
    'accept-language':    'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'origin':             'https://hivedetect.ai',
    'referer':            'https://hivedetect.ai/new',
    'sec-ch-ua':          '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile':   '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest':     'empty',
    'sec-fetch-mode':     'cors',
    'sec-fetch-site':     'same-origin',
};

const NON_GENERATOR_CLASSES = new Set([
    'ai_generated',
    'not_ai_generated',
    'deepfake',
    'inconclusive',
    'none',
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const uploadImage = async (fileBuffer, originalName, mimeType) => {
    const form = new FormData();
    form.append('media', fileBuffer, {
        filename:    originalName,
        contentType: mimeType,
    });

    const response = await axios.post(`${BASE_URL}/api/v1/upload`, form, {
        headers: {
            ...HEADERS,
            ...form.getHeaders(),
        },
    });

    const data = response.data;

    if (data.status_code !== 200 || !data.data?.short_key) {
        throw new Error(data.message || 'Upload failed');
    }

    return data.data.short_key;
};

const pollResult = async (shortKey, maxAttempts = 20, intervalMs = 1500) => {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await axios.get(`${BASE_URL}/json/${shortKey}.json`, {
                headers: {
                    ...HEADERS,
                    'accept': 'application/json',
                },
                validateStatus: (s) => s === 200 || s === 304,
            });

            if (response.status === 200 && response.data?.visual) {
                return response.data;
            }
        } catch {
        }

        await sleep(intervalMs);
    }

    throw new Error('Detection timed out. Please try again.');
};

const parseResult = (raw) => {
    const visual  = raw.visual;
    const status  = visual?.status?.[0]?.response;
    const input   = status?.input;
    const output  = status?.output?.[0];
    const classes = output?.classes || [];
    const algTags = output?.algorithmic_tags || {};

    const find = (cls) => classes.find(c => c.class === cls)?.score ?? 0;

    const aiScore       = find('ai_generated');
    const notAiScore    = find('not_ai_generated');
    const deepfakeScore = find('deepfake');

    const topGenerators = classes
        .filter(c => !NON_GENERATOR_CLASSES.has(c.class) && c.score > 0.001)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(c => ({
            name:    c.class,
            score:   c.score,
            percent: (c.score * 100).toFixed(2),
        }));

    return {
        extension: raw.extension,
        media: {
            width:    input?.media?.width    || 0,
            height:   input?.media?.height   || 0,
            mimeType: input?.media?.mimetype || '',
        },
        scores: {
            ai_generated:     aiScore,
            not_ai_generated: notAiScore,
            deepfake:         deepfakeScore,
        },
        verdict:    aiScore > 0.5 ? 'AI Generated' : 'Not AI Generated',
        confidence: aiScore > 0.5
            ? (aiScore * 100).toFixed(2)
            : (notAiScore * 100).toFixed(2),
        topGenerators,
        algorithmicTags: {
            c2pa: algTags.c2pa || {},
            exif: algTags.exif || {},
            xmp:  algTags.xmp  || {},
        },
    };
};

const detectImage = async (fileBuffer, originalName, mimeType) => {
    const shortKey = await uploadImage(fileBuffer, originalName, mimeType);
    const raw      = await pollResult(shortKey);
    const result   = parseResult(raw);

    result.shortKey = shortKey;
    result.mediaUrl = `${BASE_URL}/media/${shortKey}`;

    return result;
};

module.exports = { detectImage };
