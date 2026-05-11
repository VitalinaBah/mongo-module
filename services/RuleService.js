const Rule = require('../models/Rule');

/**
 * RuleService — рушій правил IF-THEN.
 * Правило: IF <criteriaName> <op> <value> THEN <action> [<actionValue>%]
 * Дії: reject (виключити), bonus (додати %), penalty (відняти %)
 */
class RuleService {

  async getAll() {
    return Rule.find().sort({ createdAt: -1 });
  }

  async create(data) {
    return Rule.create(data);
  }

  async update(id, data) {
    const rule = await Rule.findByIdAndUpdate(id, data, { new: true });
    if (!rule) throw new Error('Rule not found');
    return rule;
  }

  async toggle(id) {
    const rule = await Rule.findById(id);
    if (!rule) throw new Error('Rule not found');
    rule.enabled = !rule.enabled;
    await rule.save();
    return rule;
  }

  async remove(id) {
    const rule = await Rule.findByIdAndDelete(id);
    if (!rule) throw new Error('Rule not found');
  }

  // ── Застосування правил ───────────────────────────────────────────────────

  _evalCondition(score, operator, threshold) {
    switch (operator) {
      case '>':  return score > threshold;
      case '<':  return score < threshold;
      case '>=': return score >= threshold;
      case '<=': return score <= threshold;
      case '=':  return score === threshold;
      case '!=': return score !== threshold;
      default:   return false;
    }
  }

  /**
   * Застосувати активні правила до результатів аналізу.
   * @param {Array} ranking  [{ alternative, score, ... }]
   * @param {Array} matrix   [{ name, scores: [Number] }]  — сирі оцінки
   * @param {Array} criteria [{ name, ... }]
   * @returns { filtered: Array, appliedRules: Array }
   */
  async applyRules(ranking, matrix, criteria) {
    const rules = await Rule.find({ enabled: true });
    const appliedLog = [];

    let result = ranking.map(item => ({ ...item }));

    for (const rule of rules) {
      const cIdx = criteria.findIndex(c => c.name === rule.condition.criteriaName);
      if (cIdx === -1) continue;

      result = result.filter(item => {
        const matrixRow = matrix.find(m => m.name === item.alternative);
        if (!matrixRow) return true;

        const rawScore = matrixRow.scores[cIdx];
        const condMet  = this._evalCondition(rawScore, rule.condition.operator, rule.condition.value);

        if (!condMet) return true;

        if (rule.action.type === 'reject') {
          appliedLog.push({
            rule: rule.name,
            alternative: item.alternative,
            action: 'rejected',
            reason: `${rule.condition.criteriaName} ${rule.condition.operator} ${rule.condition.value}`
          });
          return false;
        }

        if (rule.action.type === 'bonus') {
          item.score *= (1 + rule.action.value / 100);
          appliedLog.push({ rule: rule.name, alternative: item.alternative, action: `+${rule.action.value}%`, reason: `${rule.condition.criteriaName} ${rule.condition.operator} ${rule.condition.value}` });
        } else if (rule.action.type === 'penalty') {
          item.score *= (1 - rule.action.value / 100);
          appliedLog.push({ rule: rule.name, alternative: item.alternative, action: `-${rule.action.value}%`, reason: `${rule.condition.criteriaName} ${rule.condition.operator} ${rule.condition.value}` });
        }
        return true;
      });
    }

    // Пере-ранжування після змін
    result.sort((a, b) => b.score - a.score).forEach((item, i) => { item.rank = i + 1; });

    return { filtered: result, appliedRules: appliedLog };
  }
}

module.exports = new RuleService();
