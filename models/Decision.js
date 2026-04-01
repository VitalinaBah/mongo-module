const mongoose = require('mongoose');

// Збереження результатів аналізу СППР
const DecisionSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['WSM', 'SAW', 'TOPSIS'],
    required: true
  },
  ranking: [
    {
      alternative: String,
      score: Number,
      rank: Number
    }
  ],
  best: {
    type: String
  },
  explanation: {
    type: String
  },
  // Знімок матриці на момент прийняття рішення
  snapshot: {
    criteria: [mongoose.Schema.Types.Mixed],
    alternatives: [mongoose.Schema.Types.Mixed]
  }
}, { timestamps: true });

module.exports = mongoose.model('Decision', DecisionSchema);
