const mongoose = require('mongoose');

const RuleSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  condition: {
    criteriaName: { type: String, required: true },
    operator:     { type: String, enum: ['>', '<', '>=', '<=', '=', '!='], required: true },
    value:        { type: Number, required: true }
  },
  action: {
    type:  { type: String, enum: ['reject', 'bonus', 'penalty'], required: true },
    value: { type: Number, default: 0 }
  },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Rule', RuleSchema);
