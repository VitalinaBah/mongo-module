const mongoose = require('mongoose');

/**
 * Експертне правило IF-THEN.
 * Приклад:
 *   IF Вартість > 500 AND Надійність < 99.9
 *   THEN reject (відхилити альтернативу)
 *
 * Дія може бути:
 *   reject  — виключити альтернативу
 *   bonus   — додати модифікатор до score
 *   penalty — відняти від score
 */
const ConditionSchema = new mongoose.Schema({
  criteriaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Criteria', required: true },
  operator:   { type: String, enum: ['>', '<', '>=', '<=', '=', '!='], required: true },
  value:      { type: Number, required: true }
}, { _id: false });

const RuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  conditions: { type: [ConditionSchema], default: [] },
  combinator: { type: String, enum: ['AND', 'OR'], default: 'AND' },
  action: {
    type: { type: String, enum: ['reject', 'bonus', 'penalty'], required: true },
    value: { type: Number, default: 0 }
  },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Rule', RuleSchema);
