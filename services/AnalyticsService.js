const CriteriaService   = require('./CriteriaService');
const AlternativeService = require('./AlternativeService');
const RuleService        = require('./RuleService');
const Decision           = require('../models/Decision');

/**
 * AnalyticsService — аналітичне ядро СППР.
 *
 * Методи згортки:
 *   WSM            — Weighted Sum Model (зважена сума, сирі значення)
 *   SAW / ADDITIVE — Simple Additive Weighting (нормалізована зважена сума)
 *   TOPSIS         — Technique for Order Preference by Similarity to Ideal Solution
 *   CAUTIOUS       — обережна (Wald): score = мінімум нормалізованих зважених оцінок
 *   MULTIPLICATIVE — мультиплікативна: score = добуток (normalized_ij ^ w_j)
 */
class AnalyticsService {

  // ── Нормалізація ──────────────────────────────────────────────────────────

  _normalize(values, type) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    if (range === 0) return values.map(() => 1);
    return values.map(v => type === 'maximize' ? (v - min) / range : (max - v) / range);
  }

  _normalizeEuclidean(values) {
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
    if (norm === 0) return values.map(() => 0);
    return values.map(v => v / norm);
  }

  _rank(items) {
    return [...items].sort((a, b) => b.score - a.score).map((item, i) => ({ ...item, rank: i + 1 }));
  }

  _explain(method, ranking, criteriaList, appliedRules = []) {
    const best  = ranking[0];
    const worst = ranking[ranking.length - 1];
    const topCriteria = [...criteriaList]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(c => `${c.name} (вага ${c.weight.toFixed(2)}, ${c.type})`)
      .join(', ');

    let explanation =
      `Метод ${method}: найкращою альтернативою визначено "${best.alternative}" ` +
      `(інтегральна оцінка ${best.score.toFixed(4)}). ` +
      `Найгіршою є "${worst.alternative}" (оцінка ${worst.score.toFixed(4)}). ` +
      `Найвагоміші критерії: ${topCriteria}.`;

    if (appliedRules.length > 0) {
      const rejects   = appliedRules.filter(r => r.action === 'rejected').map(r => r.alternative);
      const bonuses   = appliedRules.filter(r => r.action.includes('+'));
      const penalties = appliedRules.filter(r => r.action.includes('-'));
      if (rejects.length)   explanation += ` Відкинуто через правила: ${rejects.join(', ')}.`;
      if (bonuses.length)   explanation += ` Отримали бонус: ${bonuses.map(r => r.alternative).join(', ')}.`;
      if (penalties.length) explanation += ` Отримали штраф: ${penalties.map(r => r.alternative).join(', ')}.`;
    }

    return explanation;
  }

  // ── Методи згортки ────────────────────────────────────────────────────────

  wsm(matrix, criteria) {
    return matrix.map(alt => {
      const score = criteria.reduce((sum, c, j) => {
        const rawScore = c.type === 'minimize' ? -alt.scores[j] : alt.scores[j];
        return sum + c.weight * rawScore;
      }, 0);
      return { alternative: alt.name, score };
    });
  }

  saw(matrix, criteria) {
    const normalized = criteria.map((c, j) => {
      const col = matrix.map(alt => alt.scores[j]);
      return this._normalize(col, c.type);
    });
    return matrix.map((alt, i) => {
      const score = criteria.reduce((sum, c, j) => sum + c.weight * normalized[j][i], 0);
      return { alternative: alt.name, score };
    });
  }

  topsis(matrix, criteria) {
    const normCols = criteria.map((c, j) =>
      this._normalizeEuclidean(matrix.map(alt => alt.scores[j]))
    );
    const weighted = matrix.map((alt, i) => criteria.map((c, j) => c.weight * normCols[j][i]));

    const ideal = criteria.map((c, j) => {
      const col = weighted.map(row => row[j]);
      return c.type === 'maximize' ? Math.max(...col) : Math.min(...col);
    });
    const antiIdeal = criteria.map((c, j) => {
      const col = weighted.map(row => row[j]);
      return c.type === 'maximize' ? Math.min(...col) : Math.max(...col);
    });

    return matrix.map((alt, i) => {
      const dPlus  = Math.sqrt(criteria.reduce((s, _, j) => s + Math.pow(weighted[i][j] - ideal[j], 2), 0));
      const dMinus = Math.sqrt(criteria.reduce((s, _, j) => s + Math.pow(weighted[i][j] - antiIdeal[j], 2), 0));
      const score  = dPlus + dMinus === 0 ? 0 : dMinus / (dPlus + dMinus);
      return { alternative: alt.name, score };
    });
  }

  cautious(matrix, criteria) {
    const normalized = criteria.map((c, j) => {
      const col = matrix.map(alt => alt.scores[j]);
      return this._normalize(col, c.type);
    });
    return matrix.map((alt, i) => {
      const wScores = criteria.map((c, j) => c.weight * normalized[j][i]);
      return { alternative: alt.name, score: Math.min(...wScores) };
    });
  }

  multiplicative(matrix, criteria) {
    const normalized = criteria.map((c, j) => {
      const col = matrix.map(alt => alt.scores[j]);
      return this._normalize(col, c.type);
    });
    return matrix.map((alt, i) => {
      const score = criteria.reduce((prod, c, j) => {
        const v = normalized[j][i];
        return prod * Math.pow(v < 1e-9 ? 1e-9 : v, c.weight);
      }, 1);
      return { alternative: alt.name, score };
    });
  }

  // ── Порогова фільтрація ───────────────────────────────────────────────────

  _applyThresholds(matrix, criteria) {
    const rejected = [];
    const allowed  = matrix.filter(alt => {
      for (let j = 0; j < criteria.length; j++) {
        const c = criteria[j];
        if (c.threshold == null) continue;
        const score = alt.scores[j];
        const pass  = c.type === 'maximize' ? score >= c.threshold : score <= c.threshold;
        if (!pass) {
          rejected.push({ alternative: alt.name, criteria: c.name, threshold: c.threshold, actual: score });
          return false;
        }
      }
      return true;
    });
    return { allowed, rejected };
  }

  // ── Аналіз чутливості ────────────────────────────────────────────────────

  async sensitivity(criteriaName, method = 'SAW', steps = 20) {
    const criteriaList = await CriteriaService.getAll();
    const criteriaIds  = criteriaList.map(c => c._id.toString());
    const matrix       = await AlternativeService.getMatrix(criteriaIds);

    const idx = criteriaList.findIndex(c => c.name === criteriaName);
    if (idx === -1) throw new Error(`Criteria "${criteriaName}" not found`);

    const othersWeight = criteriaList.reduce((s, c, i) => i !== idx ? s + c.weight : s, 0);
    const points = [];

    for (let step = 0; step <= steps; step++) {
      const w     = step / steps;
      const scale = othersWeight > 0 ? (1 - w) / othersWeight : 0;

      const adjusted = criteriaList.map((c, i) => ({
        name: c.name, type: c.type, threshold: c.threshold,
        weight: i === idx ? w : c.weight * scale
      }));

      const rawScores = this._runMethod(method, matrix, adjusted);
      points.push({
        weight: w,
        scores: rawScores.map(r => ({ alternative: r.alternative, score: +r.score.toFixed(4) }))
      });
    }

    return { criteriaName, method, points };
  }

  // ── Сценарний аналіз ─────────────────────────────────────────────────────

  async scenarios(scenarios) {
    const criteriaList = await CriteriaService.getAll();
    const criteriaIds  = criteriaList.map(c => c._id.toString());
    const matrix       = await AlternativeService.getMatrix(criteriaIds);

    return scenarios.map(scenario => {
      const adjusted = criteriaList.map(c => ({
        name: c.name, type: c.type, threshold: c.threshold,
        weight: (scenario.weights && scenario.weights[c.name] !== undefined)
          ? scenario.weights[c.name]
          : c.weight
      }));
      const method    = (scenario.method || 'SAW').toUpperCase();
      const rawScores = this._runMethod(method, matrix, adjusted);
      const ranking   = this._rank(rawScores);
      return { scenario: scenario.name || 'Unnamed', method, ranking, best: ranking[0]?.alternative };
    });
  }

  // ── Аналіз стабільності ──────────────────────────────────────────────────

  async stability() {
    const criteriaList = await CriteriaService.getAll();
    const criteriaIds  = criteriaList.map(c => c._id.toString());
    const matrix       = await AlternativeService.getMatrix(criteriaIds);

    const methods = ['WSM', 'SAW', 'TOPSIS', 'CAUTIOUS', 'MULTIPLICATIVE'];
    const results = {};
    for (const m of methods) {
      results[m] = this._rank(this._runMethod(m, matrix, criteriaList));
    }

    const consensus = matrix.map(a => {
      const avgRank = methods.reduce((s, m) => {
        const r = results[m].find(r => r.alternative === a.name);
        return s + (r ? r.rank : methods.length);
      }, 0) / methods.length;
      return { alternative: a.name, avgRank: +avgRank.toFixed(2) };
    }).sort((a, b) => a.avgRank - b.avgRank);

    return { methods: results, consensus };
  }

  // ── Внутрішній диспетчер ──────────────────────────────────────────────────

  _runMethod(method, matrix, criteria) {
    switch (method.toUpperCase()) {
      case 'WSM':            return this.wsm(matrix, criteria);
      case 'SAW':
      case 'ADDITIVE':       return this.saw(matrix, criteria);
      case 'TOPSIS':         return this.topsis(matrix, criteria);
      case 'CAUTIOUS':       return this.cautious(matrix, criteria);
      case 'MULTIPLICATIVE': return this.multiplicative(matrix, criteria);
      default: throw new Error(`Unknown method: ${method}`);
    }
  }

  // ── Публічний API ─────────────────────────────────────────────────────────

  async analyze(method = 'SAW', applyRules = false) {
    const criteriaList = await CriteriaService.getAll();
    if (criteriaList.length === 0) throw new Error('No criteria defined');

    const criteriaIds = criteriaList.map(c => c._id.toString());
    const matrix      = await AlternativeService.getMatrix(criteriaIds);
    if (matrix.length === 0) throw new Error('No alternatives defined');

    const { allowed, rejected } = this._applyThresholds(matrix, criteriaList);
    const workingMatrix = allowed.length > 0 ? allowed : matrix;

    const rawScores = this._runMethod(method, workingMatrix, criteriaList);
    let ranking     = this._rank(rawScores);

    let appliedRules = [];
    if (applyRules) {
      const { filtered, appliedRules: ar } = await RuleService.applyRules(ranking, workingMatrix, criteriaList);
      ranking      = filtered;
      appliedRules = ar;
    }

    const best        = ranking[0]?.alternative;
    const explanation = this._explain(method.toUpperCase(), ranking, criteriaList, appliedRules);

    const decision = new Decision({
      method: method.toUpperCase(),
      ranking,
      best,
      explanation,
      snapshot: {
        criteria:     criteriaList.map(c => ({ name: c.name, weight: c.weight, type: c.type })),
        alternatives: workingMatrix.map(a => ({ name: a.name, scores: a.scores }))
      }
    });
    await decision.save();

    return {
      method: method.toUpperCase(),
      ranking,
      best,
      explanation,
      rejectedByThreshold: rejected,
      appliedRules
    };
  }

  async analyzeAll() {
    const methods = ['WSM', 'SAW', 'TOPSIS', 'CAUTIOUS', 'MULTIPLICATIVE'];
    const results = {};
    for (const m of methods) {
      results[m] = await this.analyze(m, false);
    }
    return results;
  }

  async getHistory() {
    return Decision.find().sort({ createdAt: -1 }).limit(20);
  }
}

module.exports = new AnalyticsService();
