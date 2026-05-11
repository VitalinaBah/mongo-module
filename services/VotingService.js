const { parse } = require('csv-parse/sync');
const axios      = require('axios');
const VoteSession = require('../models/VoteSession');
const Criteria   = require('../models/Criteria');

/**
 * VotingService — 4 методи голосування для визначення ваг критеріїв.
 *
 * Формат вхідних даних (CSV / Google Sheets):
 * Рядок 1: "Ім'я" | <Критерій1> | <Критерій2> | ...
 * Рядки 2+: <ПрізвищеЕксперта> | <ранг/бал> | ...
 *   - Для plurality: 1 = обраний критерій, 0 = ні
 *   - Для borda / condorcet: ранг (1 = найважливіший)
 *   - Для approval: 1 = схвалено, 0 = ні
 *
 * Чотири методи голосування (стор. 94 підручника):
 *   1. plurality  — абсолютна більшість (plurality rule)
 *   2. borda      — метод Борда (бали за зворотним рангом)
 *   3. condorcet  — попарне порівняння (метод Кондорсе)
 *   4. approval   — схвальне голосування (approval voting)
 */
class VotingService {

  _parseCSV(text) {
    return parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  }

  _extractRows(rows) {
    const headers = Object.keys(rows[0]);
    const nameCol = headers[0];
    const criteriaNames = headers.slice(1);

    return {
      criteriaNames,
      voteRows: rows.map(r => ({
        expert: r[nameCol],
        values: Object.fromEntries(criteriaNames.map(c => [c, Number(r[c] || 0)]))
      }))
    };
  }

  // ── Методи голосування ────────────────────────────────────────────────────

  /**
   * 1. Plurality — кожен експерт обирає 1 критерій (value = 1), решта 0.
   * Вага = кількість голосів / загальна кількість.
   */
  _plurality(criteriaNames, voteRows) {
    const counts = Object.fromEntries(criteriaNames.map(c => [c, 0]));
    for (const row of voteRows) {
      // Обирається критерій з найбільшим значенням
      const top = criteriaNames.reduce((best, c) => row.values[c] > row.values[best] ? c : best, criteriaNames[0]);
      counts[top]++;
    }
    const total = voteRows.length;
    return criteriaNames.map(c => ({ criteriaName: c, weight: total > 0 ? counts[c] / total : 0 }));
  }

  /**
   * 2. Borda — ранги 1..N (1 = найкращий).
   * Бал критерія = sum(N - rank_i + 1). Нормалізується до 0..1.
   */
  _borda(criteriaNames, voteRows) {
    const N = criteriaNames.length;
    const scores = Object.fromEntries(criteriaNames.map(c => [c, 0]));
    for (const row of voteRows) {
      for (const c of criteriaNames) {
        const rank = row.values[c] || N;
        scores[c] += N - rank + 1;
      }
    }
    const total = Object.values(scores).reduce((s, v) => s + v, 0);
    return criteriaNames.map(c => ({ criteriaName: c, weight: total > 0 ? scores[c] / total : 0 }));
  }

  /**
   * 3. Condorcet — попарне порівняння.
   * Критерій A перемагає B, якщо більшість експертів мають rank(A) < rank(B).
   * Вага = кількість перемог / (N-1).
   */
  _condorcet(criteriaNames, voteRows) {
    const N = criteriaNames.length;
    const wins = Object.fromEntries(criteriaNames.map(c => [c, 0]));

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = criteriaNames[i];
        const b = criteriaNames[j];
        let votesA = 0, votesB = 0;
        for (const row of voteRows) {
          if ((row.values[a] || N) < (row.values[b] || N)) votesA++;
          else if ((row.values[b] || N) < (row.values[a] || N)) votesB++;
        }
        if (votesA > votesB) wins[a]++;
        else if (votesB > votesA) wins[b]++;
      }
    }

    const total = Object.values(wins).reduce((s, v) => s + v, 0) || 1;
    return criteriaNames.map(c => ({ criteriaName: c, weight: wins[c] / total }));
  }

  /**
   * 4. Approval — кожен може схвалити будь-яку кількість критеріїв (1 = схвалено).
   * Вага = кількість схвалень / (total_approvals).
   */
  _approval(criteriaNames, voteRows) {
    const counts = Object.fromEntries(criteriaNames.map(c => [c, 0]));
    for (const row of voteRows) {
      for (const c of criteriaNames) {
        if (row.values[c] >= 1) counts[c]++;
      }
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
    return criteriaNames.map(c => ({ criteriaName: c, weight: counts[c] / total }));
  }

  // ── Нормалізація ──────────────────────────────────────────────────────────

  _normalizeWeights(weights) {
    const sum = weights.reduce((s, w) => s + w.weight, 0);
    if (sum === 0) return weights.map(w => ({ ...w, weight: 1 / weights.length }));
    return weights.map(w => ({ ...w, weight: Math.round(w.weight / sum * 10000) / 10000 }));
  }

  // ── Публічний API ─────────────────────────────────────────────────────────

  _compute(method, criteriaNames, voteRows) {
    let raw;
    switch (method) {
      case 'plurality': raw = this._plurality(criteriaNames, voteRows); break;
      case 'borda':     raw = this._borda(criteriaNames, voteRows); break;
      case 'condorcet': raw = this._condorcet(criteriaNames, voteRows); break;
      case 'approval':  raw = this._approval(criteriaNames, voteRows); break;
      default: throw new Error(`Unknown voting method: ${method}`);
    }
    return this._normalizeWeights(raw);
  }

  async voteManual(method, rawData) {
    const { criteriaNames, voteRows } = this._extractRows(rawData);
    const results = this._compute(method, criteriaNames, voteRows);
    const session = await VoteSession.create({ method, source: 'manual', rawData: voteRows, results });
    return session;
  }

  async importFromCSVBuffer(method, buffer) {
    const text = buffer.toString('utf-8');
    const rows = this._parseCSV(text);
    const { criteriaNames, voteRows } = this._extractRows(rows);
    const results = this._compute(method, criteriaNames, voteRows);
    const session = await VoteSession.create({ method, source: 'manual', rawData: voteRows, results });
    return session;
  }

  async importFromGoogleSheets(method, sheetUrl) {
    let csvUrl = sheetUrl;
    const match = sheetUrl.match(/\/d\/([^/]+)/);
    if (match) {
      const id  = match[1];
      const gid = (sheetUrl.match(/gid=(\d+)/) || [])[1] || '0';
      csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
    const resp = await axios.get(csvUrl, { responseType: 'text', timeout: 10000 });
    const rows = this._parseCSV(resp.data);
    const { criteriaNames, voteRows } = this._extractRows(rows);
    const results = this._compute(method, criteriaNames, voteRows);
    const session = await VoteSession.create({ method, source: 'google-sheets', sheetUrl, rawData: voteRows, results });
    return session;
  }

  async getAll() {
    return VoteSession.find().sort({ createdAt: -1 });
  }

  /**
   * Застосувати результати сесії голосування як ваги критеріїв у БД.
   */
  async applySessionToCriteria(sessionId) {
    const session = await VoteSession.findById(sessionId);
    if (!session) throw new Error('VoteSession not found');

    const applied = [];
    for (const r of session.results) {
      const criteria = await Criteria.findOne({ name: r.criteriaName });
      if (criteria) {
        criteria.weight = r.weight;
        await criteria.save();
        applied.push({ name: r.criteriaName, weight: r.weight });
      }
    }
    return applied;
  }
}

module.exports = new VotingService();
