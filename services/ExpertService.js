const { parse } = require('csv-parse/sync');
const axios     = require('axios');
const Expert    = require('../models/Expert');

/**
 * ExpertService — управління експертними оцінками.
 *
 * Формат таблиці Google Sheets / CSV:
 * Рядок 1: заголовки — "Ім'я" | "Альтернатива" | "Критерій1" | "Критерій2" | ...
 *           АБО         "Ім'я" | "Альтернатива" | "Критерій" | "Оцінка"   (тонкий формат)
 *
 * Автовизначення: якщо є стовпці "Критерій" і "Оцінка" — тонкий формат,
 * інакше — широкий (кожен критерій = окремий стовпець).
 */
class ExpertService {

  // ── Парсинг CSV ────────────────────────────────────────────────────────────

  _parseCSV(csvText) {
    return parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });
  }

  _buildRatings(rows) {
    const headers = Object.keys(rows[0]);
    const thin = headers.includes('Критерій') && headers.includes('Оцінка');

    const ratings = [];
    for (const row of rows) {
      const name = row["Ім'я"] || row['Expert'] || row['Ім_я'] || Object.values(row)[0];
      const alt  = row['Альтернатива'] || row['Alternative'] || Object.values(row)[1];

      if (thin) {
        ratings.push({ expertName: name, alternativeName: alt, criteriaName: row['Критерій'], score: Number(row['Оцінка']) });
      } else {
        for (const h of headers) {
          if (h === "Ім'я" || h === 'Ім_я' || h === 'Expert' || h === 'Альтернатива' || h === 'Alternative') continue;
          if (row[h] !== '' && !isNaN(Number(row[h]))) {
            ratings.push({ expertName: name, alternativeName: alt, criteriaName: h, score: Number(row[h]) });
          }
        }
      }
    }
    return ratings;
  }

  async _saveExperts(flatRatings, source) {
    // Групуємо за ім'ям експерта
    const byExpert = {};
    for (const r of flatRatings) {
      if (!byExpert[r.expertName]) byExpert[r.expertName] = [];
      byExpert[r.expertName].push({ alternativeName: r.alternativeName, criteriaName: r.criteriaName, score: r.score });
    }

    const saved = [];
    for (const [name, ratings] of Object.entries(byExpert)) {
      let expert = await Expert.findOne({ name });
      if (expert) {
        expert.ratings = ratings;
        expert.source  = source;
        await expert.save();
      } else {
        expert = await Expert.create({ name, source, ratings });
      }
      saved.push(expert);
    }
    return saved;
  }

  // ── Публічний API ──────────────────────────────────────────────────────────

  async importFromCSVBuffer(buffer) {
    const text     = buffer.toString('utf-8');
    const rows     = this._parseCSV(text);
    const ratings  = this._buildRatings(rows);
    return this._saveExperts(ratings, 'csv');
  }

  async importFromGoogleSheets(sheetUrl) {
    // Перетворюємо URL перегляду на URL експорту CSV
    let csvUrl = sheetUrl;
    const match = sheetUrl.match(/\/d\/([^/]+)/);
    if (match) {
      const id  = match[1];
      const gid = (sheetUrl.match(/gid=(\d+)/) || [])[1] || '0';
      csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }

    const resp = await axios.get(csvUrl, { responseType: 'text', timeout: 10000 });
    const rows = this._parseCSV(resp.data);
    const ratings = this._buildRatings(rows);
    return this._saveExperts(ratings, 'google-sheets');
  }

  async getAll() {
    return Expert.find().sort({ createdAt: -1 });
  }

  async remove(id) {
    const expert = await Expert.findByIdAndDelete(id);
    if (!expert) throw new Error('Expert not found');
  }

  // ── Методи узгодження ──────────────────────────────────────────────────────

  /**
   * aggregate(method) — зводить оцінки всіх експертів в єдину матрицю.
   * @param {'mean'|'median'|'weighted'} method
   * @returns { [{ alternativeName, criteriaName, score }] }
   */
  async aggregate(method = 'mean') {
    const experts = await Expert.find();
    if (experts.length === 0) throw new Error('No experts loaded');

    // Збираємо всі оцінки в map: "alt|crit" -> [{ score, weight }]
    const map = {};
    for (const expert of experts) {
      for (const r of expert.ratings) {
        const key = `${r.alternativeName}|||${r.criteriaName}`;
        if (!map[key]) map[key] = [];
        map[key].push({ score: r.score, weight: expert.weight || 1 });
      }
    }

    const result = [];
    for (const [key, entries] of Object.entries(map)) {
      const [alternativeName, criteriaName] = key.split('|||');
      const scores = entries.map(e => e.score);
      let score;

      if (method === 'mean') {
        score = scores.reduce((s, v) => s + v, 0) / scores.length;
      } else if (method === 'median') {
        const sorted = [...scores].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        score = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      } else if (method === 'weighted') {
        const totalW = entries.reduce((s, e) => s + e.weight, 0);
        score = entries.reduce((s, e) => s + e.score * e.weight, 0) / totalW;
      } else {
        throw new Error(`Unknown aggregation method: ${method}. Use mean, median, or weighted`);
      }

      result.push({ alternativeName, criteriaName, score: Math.round(score * 1000) / 1000 });
    }
    return result;
  }

  /**
   * Оновити оцінки альтернатив у БД на основі узгоджених оцінок.
   */
  async applyAggregatedToAlternatives(method = 'mean') {
    const Alternative = require('../models/Alternative');
    const aggregated = await this.aggregate(method);

    for (const { alternativeName, criteriaName, score } of aggregated) {
      const alt = await Alternative.findOne({ name: alternativeName });
      if (!alt) continue;
      // Зберігаємо за назвою критерія (ключ у Map)
      alt.scores.set(criteriaName, score);
      await alt.save();
    }
    return aggregated;
  }
}

module.exports = new ExpertService();
