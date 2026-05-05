const mongoose = require('mongoose');

/**
 * Експертна оцінка, отримана з CSV-файлу (наприклад, Google Forms).
 * Кожен запис — оцінки одного експерта по альтернативах та критеріях.
 */
const ExpertScoreSchema = new mongoose.Schema({
  alternativeName: { type: String, required: true },
  criteriaName:    { type: String, required: true },
  score:           { type: Number, required: true }
}, { _id: false });

const ExpertSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  scores:      { type: [ExpertScoreSchema], default: [] },
  source:      { type: String, default: 'manual' } // manual | csv-import
}, { timestamps: true });

module.exports = mongoose.model('Expert', ExpertSchema);
