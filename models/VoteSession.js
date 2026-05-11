const mongoose = require('mongoose');

const VoteRowSchema = new mongoose.Schema({
  expert:  { type: String, required: true },
  // ranks or points per criteria: { criteriaName -> value }
  values:  { type: Map, of: Number }
}, { _id: false });

const VoteResultSchema = new mongoose.Schema({
  criteriaName: { type: String, required: true },
  weight:       { type: Number, required: true }
}, { _id: false });

const VoteSessionSchema = new mongoose.Schema({
  method:  { type: String, enum: ['plurality', 'borda', 'condorcet', 'approval'], required: true },
  source:  { type: String, enum: ['google-sheets', 'manual'], default: 'manual' },
  sheetUrl: { type: String, default: '' },
  rawData:  [VoteRowSchema],
  results:  [VoteResultSchema]
}, { timestamps: true });

module.exports = mongoose.model('VoteSession', VoteSessionSchema);
