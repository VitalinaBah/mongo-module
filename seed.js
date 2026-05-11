require('dotenv').config();
const mongoose   = require('mongoose');
const connectDB  = require('./db');
const Criteria   = require('./models/Criteria');
const Alternative = require('./models/Alternative');
const Rule       = require('./models/Rule');
const Expert     = require('./models/Expert');

async function seed() {
  await connectDB();
  console.log('Seeding...');

  // Очистити колекції
  await Promise.all([Criteria.deleteMany(), Alternative.deleteMany(), Rule.deleteMany(), Expert.deleteMany()]);

  // ── Критерії ──────────────────────────────────────────────────
  const criteria = await Criteria.insertMany([
    { name: 'Вартість',         type: 'minimize', weight: 0.30, threshold: 800  },
    { name: 'Надійність',       type: 'maximize', weight: 0.25, threshold: 99.5 },
    { name: 'Швидкість',        type: 'minimize', weight: 0.20, threshold: null },
    { name: 'Підтримка',        type: 'maximize', weight: 0.15, threshold: null },
    { name: 'Масштабованість',  type: 'maximize', weight: 0.10, threshold: null }
  ]);
  console.log(`✓ ${criteria.length} criteria`);

  const idMap = {};
  criteria.forEach(c => { idMap[c.name] = c._id.toString(); });

  // ── Альтернативи + оцінки ────────────────────────────────────
  const altData = [
    { name: 'AWS',          description: 'Amazon Web Services',      scores: [450, 99.99, 45, 8, 9] },
    { name: 'Azure',        description: 'Microsoft Azure',          scores: [400, 99.95, 55, 9, 8] },
    { name: 'Google Cloud', description: 'Google Cloud Platform',    scores: [380, 99.90, 40, 7, 10] },
    { name: 'DigitalOcean', description: 'DigitalOcean',             scores: [120, 99.70, 35, 6, 6]  }
  ];
  const critNames = ['Вартість','Надійність','Швидкість','Підтримка','Масштабованість'];
  const alternatives = await Alternative.insertMany(altData.map(a => {
    const scores = {};
    critNames.forEach((n, i) => { scores[idMap[n]] = a.scores[i]; });
    return { name: a.name, description: a.description, scores };
  }));
  console.log(`✓ ${alternatives.length} alternatives`);

  // ── Правила ───────────────────────────────────────────────────
  const rules = await Rule.insertMany([
    {
      name: 'Бюджетний ліміт',
      description: 'Відкидає провайдерів дорожчих за $700/міс',
      condition: { criteriaName: 'Вартість', operator: '>', value: 700 },
      action: { type: 'reject', value: 0 },
      enabled: false
    },
    {
      name: 'Бонус за надійність',
      description: 'Бонус +10% для uptime > 99.95%',
      condition: { criteriaName: 'Надійність', operator: '>', value: 99.95 },
      action: { type: 'bonus', value: 10 },
      enabled: false
    },
    {
      name: 'Штраф за повільність',
      description: 'Штраф -5% для latency > 50мс',
      condition: { criteriaName: 'Швидкість', operator: '>', value: 50 },
      action: { type: 'penalty', value: 5 },
      enabled: false
    }
  ]);
  console.log(`✓ ${rules.length} rules`);

  // ── Тестові експерти ─────────────────────────────────────────
  const experts = await Expert.insertMany([
    {
      name: 'Іван Петренко', source: 'manual', weight: 1,
      ratings: [
        { alternativeName: 'AWS',          criteriaName: 'Вартість', score: 450 },
        { alternativeName: 'AWS',          criteriaName: 'Надійність', score: 99.99 },
        { alternativeName: 'Azure',        criteriaName: 'Вартість', score: 400 },
        { alternativeName: 'Azure',        criteriaName: 'Надійність', score: 99.95 },
        { alternativeName: 'Google Cloud', criteriaName: 'Вартість', score: 380 },
        { alternativeName: 'Google Cloud', criteriaName: 'Надійність', score: 99.90 },
        { alternativeName: 'DigitalOcean', criteriaName: 'Вартість', score: 120 },
        { alternativeName: 'DigitalOcean', criteriaName: 'Надійність', score: 99.70 }
      ]
    },
    {
      name: 'Олена Коваль', source: 'manual', weight: 1.2,
      ratings: [
        { alternativeName: 'AWS',          criteriaName: 'Вартість', score: 460 },
        { alternativeName: 'AWS',          criteriaName: 'Надійність', score: 99.98 },
        { alternativeName: 'Azure',        criteriaName: 'Вартість', score: 390 },
        { alternativeName: 'Azure',        criteriaName: 'Надійність', score: 99.96 },
        { alternativeName: 'Google Cloud', criteriaName: 'Вартість', score: 370 },
        { alternativeName: 'Google Cloud', criteriaName: 'Надійність', score: 99.92 },
        { alternativeName: 'DigitalOcean', criteriaName: 'Вартість', score: 130 },
        { alternativeName: 'DigitalOcean', criteriaName: 'Надійність', score: 99.65 }
      ]
    }
  ]);
  console.log(`✓ ${experts.length} experts`);

  console.log('\n✅ Seed complete! Run: npm start');
  mongoose.connection.close();
}

seed().catch(e => { console.error(e); process.exit(1); });
