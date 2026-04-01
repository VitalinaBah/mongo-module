/**
 * Seed script — заповнює MongoDB тестовими даними.
 * Запуск: node seed.js
 *
 * Предметна область: Вибір хмарного провайдера для стартапу
 * Альтернативи: AWS, Azure, Google Cloud, DigitalOcean
 * Критерії: вартість, надійність, швидкість, підтримка, масштабованість
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Criteria = require('./models/Criteria');
const Alternative = require('./models/Alternative');
const Decision = require('./models/Decision');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dss_cloud';

// ── Дані ──────────────────────────────────────────────────────────────────

const criteriaData = [
  {
    name: 'Вартість ($/міс)',
    description: 'Середньомісячна вартість базового плану в доларах США',
    type: 'minimize',
    weight: 0.30
  },
  {
    name: 'Надійність (uptime %)',
    description: 'Гарантований рівень доступності сервісу',
    type: 'maximize',
    weight: 0.25
  },
  {
    name: 'Швидкість (мс)',
    description: 'Середня затримка відповіді (latency) у мілісекундах',
    type: 'minimize',
    weight: 0.20
  },
  {
    name: 'Технічна підтримка (1-10)',
    description: 'Оцінка якості та доступності технічної підтримки',
    type: 'maximize',
    weight: 0.15
  },
  {
    name: 'Масштабованість (1-10)',
    description: 'Можливості горизонтального та вертикального масштабування',
    type: 'maximize',
    weight: 0.10
  }
];

// Матриця оцінювання: рядки = альтернативи, стовпці = критерії (у порядку criteriaData)
const alternativesData = [
  {
    name: 'AWS',
    description: 'Amazon Web Services — найбільший хмарний провайдер',
    rawScores: [450, 99.99, 45, 9, 10]
  },
  {
    name: 'Azure',
    description: 'Microsoft Azure — хмарна платформа від Microsoft',
    rawScores: [400, 99.95, 55, 8, 9]
  },
  {
    name: 'Google Cloud',
    description: 'Google Cloud Platform — платформа від Google',
    rawScores: [380, 99.95, 40, 7, 9]
  },
  {
    name: 'DigitalOcean',
    description: 'DigitalOcean — провайдер для розробників і стартапів',
    rawScores: [100, 99.90, 30, 6, 7]
  }
];

// ── Seed ──────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Очищення
  await Promise.all([
    Criteria.deleteMany({}),
    Alternative.deleteMany({}),
    Decision.deleteMany({})
  ]);
  console.log('Collections cleared');

  // Критерії
  const criteria = await Criteria.insertMany(criteriaData);
  console.log(`Inserted ${criteria.length} criteria`);

  // Альтернативи + оцінки
  for (const altData of alternativesData) {
    const scores = new Map();
    criteria.forEach((c, idx) => {
      scores.set(c._id.toString(), altData.rawScores[idx]);
    });
    await Alternative.create({
      name: altData.name,
      description: altData.description,
      scores
    });
  }
  console.log(`Inserted ${alternativesData.length} alternatives`);

  // Матриця для контролю
  console.log('\n=== Матриця оцінювання ===');
  console.log('Альтернатива\t\t| ' + criteriaData.map(c => c.name.slice(0, 12)).join(' | '));
  alternativesData.forEach(a => {
    console.log(`${a.name.padEnd(20)}| ${a.rawScores.join('\t\t| ')}`);
  });

  console.log('\nSeed completed! Run `node server.js` then GET /api/analyze/all');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
