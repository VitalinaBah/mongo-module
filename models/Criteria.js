const mongoose = require('mongoose');

const CriteriaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['maximize', 'minimize'],
    required: true
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  // Порогове значення для фільтрації альтернатив (null = відключено)
  threshold: {
    type: Number,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Criteria', CriteriaSchema);
