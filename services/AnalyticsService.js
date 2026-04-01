const CriteriaService = require('./CriteriaService');
const AlternativeService = require('./AlternativeService');
const Decision = require('../models/Decision');

/**
 * Аналітичне ядро СППР.
 * Реалізує три методи згортки:
 *   WSM  — Weighted Sum Model (зважена сума)
 *   SAW  — Simple Additive Weighting (нормалізована зважена сума)
 *   TOPSIS — Technique for Order Preference by Similarity to Ideal Solution
 */
class AnalyticsService {

  // ── Допоміжні функції ──────────────────────────────────────────────────────

  /**
   * Нормалізація вектора по діапазону [0, 1].
   * Для maximize: (x - min) / (max - min)
   * Для minimize: (max - x) / (max - min)
   */
  _normalize(values, type) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    if (range === 0) return values.map(() => 1); // усі однакові

    return values.map(v =>
      type === 'maximize'
        ? (v - min) / range
        : (max - v) / range
    );
  }

  /**
   * Нормалізація вектора за методом TOPSIS (Евклідова).
   * r_ij = x_ij / sqrt( sum(x_ij^2) )
   */
  _normalizeEuclidean(values) {
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
    if (norm === 0) return values.map(() => 0);
    return values.map(v => v / norm);
  }

  /**
   * Ранжувати масив об'єктів за полем score (спадання).
   */
  _rank(items) {
    return [...items]
      .sort((a, b) => b.score - a.score)
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }

  /**
   * Скласти пояснення до результату.
   */
  _explain(method, ranking, criteriaList) {
    const best = ranking[0];
    const worst = ranking[ranking.length - 1];
    const topCriteria = [...criteriaList]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(c => `${c.name} (вага ${c.weight.toFixed(2)}, ${c.type})`)
      .join(', ');

    return (
      `Метод ${method}: найкращою альтернативою визначено "${best.alternative}" ` +
      `(інтегральна оцінка ${best.score.toFixed(4)}). ` +
      `Найгіршою є "${worst.alternative}" (оцінка ${worst.score.toFixed(4)}). ` +
      `Найвагоміші критерії: ${topCriteria}.`
    );
  }

  // ── Метод 1: WSM ──────────────────────────────────────────────────────────
  /**
   * Weighted Sum Model:
   *   score_i = sum_j( w_j * x_ij )
   * Значення не нормалізуються — використовуються сирі оцінки.
   */
  wsm(matrix, criteria) {
    return matrix.map(alt => {
      const score = criteria.reduce((sum, c, j) => {
        const rawScore = c.type === 'minimize' ? -alt.scores[j] : alt.scores[j];
        return sum + c.weight * rawScore;
      }, 0);
      return { alternative: alt.name, score };
    });
  }

  // ── Метод 2: SAW ──────────────────────────────────────────────────────────
  /**
   * Simple Additive Weighting:
   *   r_ij = normalize(x_ij, type_j)  [0..1]
   *   score_i = sum_j( w_j * r_ij )
   */
  saw(matrix, criteria) {
    // Нормалізуємо кожен стовпець окремо
    const normalized = criteria.map((c, j) => {
      const col = matrix.map(alt => alt.scores[j]);
      return this._normalize(col, c.type);
    });

    return matrix.map((alt, i) => {
      const score = criteria.reduce((sum, c, j) => {
        return sum + c.weight * normalized[j][i];
      }, 0);
      return { alternative: alt.name, score };
    });
  }

  // ── Метод 3: TOPSIS ───────────────────────────────────────────────────────
  /**
   * TOPSIS:
   *   1. Нормалізація Евклідова  v_ij = x_ij / ||x_j||
   *   2. Зважена матриця         w_ij = w_j * v_ij
   *   3. Ідеал (+) і антиідеал (-)
   *   4. Відстані d+ і d-
   *   5. score_i = d- / (d+ + d-)
   */
  topsis(matrix, criteria) {
    // Крок 1: Евклідова нормалізація по стовпцях
    const normCols = criteria.map((c, j) => {
      const col = matrix.map(alt => alt.scores[j]);
      return this._normalizeEuclidean(col);
    });

    // Крок 2: Зважена матриця
    const weighted = matrix.map((alt, i) =>
      criteria.map((c, j) => c.weight * normCols[j][i])
    );

    // Крок 3: Ідеальне та анти-ідеальне рішення
    const ideal = criteria.map((c, j) => {
      const col = weighted.map(row => row[j]);
      return c.type === 'maximize' ? Math.max(...col) : Math.min(...col);
    });

    const antiIdeal = criteria.map((c, j) => {
      const col = weighted.map(row => row[j]);
      return c.type === 'maximize' ? Math.min(...col) : Math.max(...col);
    });

    // Кроки 4-5: Відстані та фінальний скор
    return matrix.map((alt, i) => {
      const dPlus = Math.sqrt(
        criteria.reduce((s, _, j) => s + Math.pow(weighted[i][j] - ideal[j], 2), 0)
      );
      const dMinus = Math.sqrt(
        criteria.reduce((s, _, j) => s + Math.pow(weighted[i][j] - antiIdeal[j], 2), 0)
      );
      const score = dPlus + dMinus === 0 ? 0 : dMinus / (dPlus + dMinus);
      return { alternative: alt.name, score };
    });
  }

  // ── Публічний API ─────────────────────────────────────────────────────────

  /**
   * Запустити аналіз заданим методом і зберегти результат у MongoDB.
   * @param {string} method  'WSM' | 'SAW' | 'TOPSIS'
   * @returns {object}  { ranking, best, explanation, method }
   */
  async analyze(method = 'SAW') {
    const criteriaList = await CriteriaService.getAll();
    if (criteriaList.length === 0) throw new Error('No criteria defined');

    const criteriaIds = criteriaList.map(c => c._id.toString());
    const matrix = await AlternativeService.getMatrix(criteriaIds);
    if (matrix.length === 0) throw new Error('No alternatives defined');

    const methodKey = method.toUpperCase();
    let rawScores;

    if (methodKey === 'WSM')    rawScores = this.wsm(matrix, criteriaList);
    else if (methodKey === 'SAW')    rawScores = this.saw(matrix, criteriaList);
    else if (methodKey === 'TOPSIS') rawScores = this.topsis(matrix, criteriaList);
    else throw new Error(`Unknown method: ${method}. Use WSM, SAW, or TOPSIS`);

    const ranking = this._rank(rawScores);
    const best = ranking[0].alternative;
    const explanation = this._explain(methodKey, ranking, criteriaList);

    // Зберегти рішення в MongoDB
    const decision = new Decision({
      method: methodKey,
      ranking,
      best,
      explanation,
      snapshot: {
        criteria: criteriaList.map(c => ({
          name: c.name,
          weight: c.weight,
          type: c.type
        })),
        alternatives: matrix.map(a => ({
          name: a.name,
          scores: a.scores
        }))
      }
    });
    await decision.save();

    return { method: methodKey, ranking, best, explanation };
  }

  /**
   * Запустити всі три методи й порівняти результати.
   */
  async analyzeAll() {
    const [wsm, saw, topsis] = await Promise.all([
      this.analyze('WSM'),
      this.analyze('SAW'),
      this.analyze('TOPSIS')
    ]);
    return { WSM: wsm, SAW: saw, TOPSIS: topsis };
  }

  /**
   * Отримати всі збережені рішення з MongoDB.
   */
  async getHistory() {
    return Decision.find().sort({ createdAt: -1 }).limit(20);
  }
}

module.exports = new AnalyticsService();
