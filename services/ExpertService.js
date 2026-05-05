const { parse } = require('csv-parse/sync');
const Expert = require('../models/Expert');

class ExpertService {
  async getAll() {
    return Expert.find().sort({ createdAt: -1 });
  }

  async getById(id) {
    const expert = await Expert.findById(id);
    if (!expert) throw new Error(`Expert ${id} not found`);
    return expert;
  }

  async create(data) {
    const expert = new Expert(data);
    return expert.save();
  }

  async remove(id) {
    const expert = await Expert.findByIdAndDelete(id);
    if (!expert) throw new Error(`Expert ${id} not found`);
    return expert;
  }

  /**
   * Імпортувати CSV з оцінками експертів.
   * Очікуваний формат:
   *   Експерт,Альтернатива,Критерій,Оцінка
   *   Іван,AWS,Вартість,450
   *   ...
   */
  async importCSV(buffer) {
    const text = buffer.toString('utf-8');
    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const grouped = {};
    for (const row of rows) {
      const expertName = row['Експерт'] || row['Expert'] || row['expert'];
      const alt        = row['Альтернатива'] || row['Alternative'] || row['alternative'];
      const crit       = row['Критерій'] || row['Criteria'] || row['criteria'];
      const scoreStr   = row['Оцінка'] || row['Score'] || row['score'];

      if (!expertName || !alt || !crit || scoreStr === undefined) continue;

      if (!grouped[expertName]) grouped[expertName] = [];
      grouped[expertName].push({
        alternativeName: alt,
        criteriaName: crit,
        score: Number(scoreStr)
      });
    }

    const created = [];
    for (const [name, scores] of Object.entries(grouped)) {
      const expert = await Expert.create({
        name,
        source: 'csv-import',
        scores
      });
      created.push(expert);
    }

    return { imported: created.length, experts: created };
  }

  /**
   * Узгодити оцінки експертів одним з 3-х методів:
   *   average  — середнє арифметичне
   *   median   — медіана
   *   weighted — зважене середнє (поки що = average; розширюється)
   */
  async aggregate(method = 'average') {
    const experts = await Expert.find();
    if (experts.length === 0) return {};

    // Згрупувати оцінки: { altName: { critName: [scores] } }
    const grouped = {};
    for (const exp of experts) {
      for (const s of exp.scores) {
        if (!grouped[s.alternativeName]) grouped[s.alternativeName] = {};
        if (!grouped[s.alternativeName][s.criteriaName]) {
          grouped[s.alternativeName][s.criteriaName] = [];
        }
        grouped[s.alternativeName][s.criteriaName].push(s.score);
      }
    }

    // Згорнути за обраним методом
    const result = {};
    for (const [alt, criteria] of Object.entries(grouped)) {
      result[alt] = {};
      for (const [crit, values] of Object.entries(criteria)) {
        result[alt][crit] = this._aggregate(values, method);
      }
    }

    return { method, count: experts.length, matrix: result };
  }

  _aggregate(values, method) {
    if (values.length === 0) return 0;
    if (method === 'median') {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }
    // average / weighted (default)
    return values.reduce((s, v) => s + v, 0) / values.length;
  }
}

module.exports = new ExpertService();
