require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./db');
const dssRoutes = require('./routes/dssRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Підключитись до MongoDB
connectDB();

app.get('/api/info', (req, res) => {
  res.json({
    name: 'DSS Cloud Provider Selection API',
    description: 'Система підтримки прийняття рішень — вибір хмарного провайдера',
    version: '1.1.0',
    endpoints: {
      alternatives: ['GET/POST /api/alternatives', 'PUT/DELETE /api/alternatives/:id', 'PATCH /api/alternatives/:id/score/:criteriaId'],
      criteria:     ['GET/POST /api/criteria', 'PUT/DELETE /api/criteria/:id', 'GET /api/criteria/validate'],
      analysis:     ['GET /api/matrix', 'GET /api/analyze?method=SAW', 'GET /api/analyze/all', 'GET /api/sensitivity/:criteriaId', 'GET /api/decisions'],
      rules:        ['GET/POST /api/rules', 'PUT/DELETE /api/rules/:id', 'PATCH /api/rules/:id/toggle'],
      experts:      ['GET/POST /api/experts', 'DELETE /api/experts/:id', 'POST /api/experts/import', 'GET /api/experts/aggregate?method=average']
    }
  });
});

// API маршрути
app.use('/api', dssRoutes);

// Статичні файли SPA (Лабораторна 1 СППР)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/visualize', (req, res) => {
  res.sendFile(path.join(__dirname, 'visualize.html'));
});

// Головна сторінка — SPA (Лабораторна 1 СППР)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`DSS Server running on http://localhost:${PORT}`);
});
