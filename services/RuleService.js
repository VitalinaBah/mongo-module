const Rule = require('../models/Rule');

class RuleService {
  async getAll() {
    return Rule.find().sort({ createdAt: -1 });
  }

  async getById(id) {
    const rule = await Rule.findById(id);
    if (!rule) throw new Error(`Rule ${id} not found`);
    return rule;
  }

  async create(data) {
    const rule = new Rule(data);
    return rule.save();
  }

  async update(id, data) {
    const rule = await Rule.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!rule) throw new Error(`Rule ${id} not found`);
    return rule;
  }

  async toggle(id) {
    const rule = await Rule.findById(id);
    if (!rule) throw new Error(`Rule ${id} not found`);
    rule.enabled = !rule.enabled;
    return rule.save();
  }

  async remove(id) {
    const rule = await Rule.findByIdAndDelete(id);
    if (!rule) throw new Error(`Rule ${id} not found`);
    return rule;
  }

  /**
   * Перевірити умови правила для конкретної альтернативи.
   * @param {object} rule — правило
   * @param {object} alt  — { name, scores: { criteriaId: value } }
   * @returns {boolean} — true якщо умови виконуються
   */
  evaluate(rule, alt) {
    if (!rule.enabled || rule.conditions.length === 0) return false;

    const checks = rule.conditions.map(cond => {
      const score = alt.scores[cond.criteriaId.toString()];
      if (score === undefined || score === null) return false;
      switch (cond.operator) {
        case '>':  return score >  cond.value;
        case '<':  return score <  cond.value;
        case '>=': return score >= cond.value;
        case '<=': return score <= cond.value;
        case '=':  return score === cond.value;
        case '!=': return score !== cond.value;
        default:   return false;
      }
    });

    return rule.combinator === 'OR'
      ? checks.some(Boolean)
      : checks.every(Boolean);
  }
}

module.exports = new RuleService();
