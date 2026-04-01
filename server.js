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

// Маршрути
app.use('/api', dssRoutes);

app.get('/visualize', (req, res) => {
  res.sendFile(path.join(__dirname, 'visualize.html'));
});

// Головна сторінка — довідка по API
app.get('/', (req, res) => {
  res.json({
    name: 'DSS Cloud Provider Selection API',
    description: 'Система підтримки прийняття рішень — вибір хмарного провайдера',
    version: '1.0.0',
    endpoints: {
      alternatives: {
        'GET /api/alternatives':                         'Список альтернатив',
        'POST /api/alternatives':                        'Додати альтернативу',
        'DELETE /api/alternatives/:id':                  'Видалити альтернативу',
        'PATCH /api/alternatives/:id/score/:criteriaId': 'Встановити оцінку'
      },
      criteria: {
        'GET /api/criteria':          'Список критеріїв',
        'POST /api/criteria':         'Додати критерій',
        'DELETE /api/criteria/:id':   'Видалити критерій',
        'GET /api/criteria/validate': 'Перевірити суму ваг'
      },
      analysis: {
        'GET /api/matrix':              'Матриця оцінювання',
        'GET /api/analyze?method=SAW':  'Аналіз (SAW / WSM / TOPSIS)',
        'GET /api/analyze/all':         'Всі три методи одночасно',
        'GET /api/decisions':           'Історія рішень з MongoDB'
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`DSS Server running on http://localhost:${PORT}`);
});
