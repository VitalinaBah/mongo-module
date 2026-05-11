const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema({
  alternativeName: { type: String, required: true },
  criteriaName:    { type: String, required: true },
  score:           { type: Number, required: true }
}, { _id: false });

const ExpertSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  source:  { type: String, enum: ['google-sheets', 'csv', 'manual'], default: 'manual' },
  weight:  { type: Number, default: 1, min: 0 },
  ratings: [RatingSchema]
}, { timestamps: true });

module.exports = mongoose.model('Expert', ExpertSchema);
