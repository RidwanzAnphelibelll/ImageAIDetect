#!/usr/bin/env node

const cors    = require('cors');
const path    = require('path');
const chalk   = require('chalk');
const express = require('express');

const detectRoutes = require('./routes/detect');

const PORT = 3000;
const app  = express();

app.enable('trust proxy');
app.set('json spaces', 2);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', detectRoutes);

app.listen(PORT, () => {
    console.log(chalk.green(`Server running on http://localhost:${PORT}`));
});
