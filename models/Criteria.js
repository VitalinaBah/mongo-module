const mongoose = require('mongoose');

// Критерій оцінювання хмарного провайдера
const CriteriaSchema = new mongoose.Schema({
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
  // maximize — більше краще (наприклад, надійність)
  // minimize — менше краще (наприклад, вартість)
  type: {
    type: String,
    enum: ['maximize', 'minimize'],
    required: true
  },
  // Вага критерію (0..1), сума всіх ваг має = 1
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  }
}, { timestamps: true });

module.exports = mongoose.model('Criteria', CriteriaSchema);
