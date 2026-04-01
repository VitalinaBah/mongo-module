const mongoose = require('mongoose');

// Альтернатива — хмарний провайдер із оцінками за кожним критерієм
const AlternativeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  // scores: { criteriaId -> raw score }
  scores: {
    type: Map,
    of: Number,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Alternative', AlternativeSchema);
