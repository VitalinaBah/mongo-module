const AlternativeService = require('../services/AlternativeService');
const CriteriaService    = require('../services/CriteriaService');
const AnalyticsService   = require('../services/AnalyticsService');
const ExpertService      = require('../services/ExpertService');
const RuleService        = require('../services/RuleService');
const VotingService      = require('../services/VotingService');

const ok  = (res, data, status = 200) => res.status(status).json({ success: true, data });
const err = (res, e, status = 400)   => res.status(status).json({ success: false, error: e.message });

// ── Alternatives ──────────────────────────────────────────────────────────
exports.getAlternatives   = async (req, res) => { try { ok(res, await AlternativeService.getAll()); } catch (e) { err(res, e, 500); } };
exports.createAlternative = async (req, res) => { try { ok(res, await AlternativeService.create(req.body), 201); } catch (e) { err(res, e); } };
exports.setScore = async (req, res) => {
  try {
    const { id, criteriaId } = req.params;
    const { score } = req.body;
    if (score === undefined) return err(res, new Error('score required'));
    ok(res, await AlternativeService.setScore(id, criteriaId, Number(score)));
  } catch (e) { err(res, e); }
};
exports.deleteAlternative = async (req, res) => { try { await AlternativeService.remove(req.params.id); ok(res, { message: 'Deleted' }); } catch (e) { err(res, e, 404); } };

// ── Criteria ──────────────────────────────────────────────────────────────
exports.getCriteria    = async (req, res) => { try { ok(res, await CriteriaService.getAll()); } catch (e) { err(res, e, 500); } };
exports.createCriteria = async (req, res) => { try { ok(res, await CriteriaService.create(req.body), 201); } catch (e) { err(res, e); } };
exports.updateCriteria = async (req, res) => {
  try {
    const Criteria = require('../models/Criteria');
    const c = await Criteria.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!c) return err(res, new Error('Not found'), 404);
    ok(res, c);
  } catch (e) { err(res, e); }
};
exports.deleteCriteria  = async (req, res) => { try { await CriteriaService.remove(req.params.id); ok(res, { message: 'Deleted' }); } catch (e) { err(res, e, 404); } };
exports.validateWeights = async (req, res) => { try { ok(res, await CriteriaService.validateWeights()); } catch (e) { err(res, e, 500); } };

// ── Analytics ─────────────────────────────────────────────────────────────
exports.analyze = async (req, res) => {
  try { ok(res, await AnalyticsService.analyze(req.query.method || 'SAW', req.query.rules === 'true')); } catch (e) { err(res, e); }
};
exports.analyzeAll         = async (req, res) => { try { ok(res, await AnalyticsService.analyzeAll()); } catch (e) { err(res, e); } };
exports.getDecisionHistory = async (req, res) => { try { ok(res, await AnalyticsService.getHistory()); } catch (e) { err(res, e, 500); } };
exports.getMatrix = async (req, res) => {
  try {
    const criteriaList = await CriteriaService.getAll();
    const criteriaIds  = criteriaList.map(c => c._id.toString());
    ok(res, { criteria: criteriaList, matrix: await AlternativeService.getMatrix(criteriaIds) });
  } catch (e) { err(res, e, 500); }
};
exports.sensitivity = async (req, res) => {
  try {
    const { criteria, method, steps } = req.query;
    if (!criteria) return err(res, new Error('criteria query param required'));
    ok(res, await AnalyticsService.sensitivity(criteria, method || 'SAW', Number(steps) || 20));
  } catch (e) { err(res, e); }
};
exports.scenarios = async (req, res) => {
  try {
    const { scenarios } = req.body;
    if (!Array.isArray(scenarios)) return err(res, new Error('scenarios array required'));
    ok(res, await AnalyticsService.scenarios(scenarios));
  } catch (e) { err(res, e); }
};
exports.stability = async (req, res) => { try { ok(res, await AnalyticsService.stability()); } catch (e) { err(res, e); } };

// ── Experts ───────────────────────────────────────────────────────────────
exports.getExperts          = async (req, res) => { try { ok(res, await ExpertService.getAll()); } catch (e) { err(res, e, 500); } };
exports.importExpertsCSV    = async (req, res) => {
  try { if (!req.file) return err(res, new Error('CSV file required')); ok(res, await ExpertService.importFromCSVBuffer(req.file.buffer), 201); } catch (e) { err(res, e); }
};
exports.importExpertsSheets = async (req, res) => {
  try { const { url } = req.body; if (!url) return err(res, new Error('url required')); ok(res, await ExpertService.importFromGoogleSheets(url), 201); } catch (e) { err(res, e); }
};
exports.aggregateExperts = async (req, res) => { try { ok(res, await ExpertService.aggregate(req.query.method || 'mean')); } catch (e) { err(res, e); } };
exports.applyAggregated  = async (req, res) => {
  try { ok(res, await ExpertService.applyAggregatedToAlternatives(req.body.method || 'mean')); } catch (e) { err(res, e); }
};
exports.deleteExpert = async (req, res) => { try { await ExpertService.remove(req.params.id); ok(res, { message: 'Deleted' }); } catch (e) { err(res, e, 404); } };

// ── Rules ─────────────────────────────────────────────────────────────────
exports.getRules    = async (req, res) => { try { ok(res, await RuleService.getAll()); } catch (e) { err(res, e, 500); } };
exports.createRule  = async (req, res) => { try { ok(res, await RuleService.create(req.body), 201); } catch (e) { err(res, e); } };
exports.updateRule  = async (req, res) => { try { ok(res, await RuleService.update(req.params.id, req.body)); } catch (e) { err(res, e); } };
exports.toggleRule  = async (req, res) => { try { ok(res, await RuleService.toggle(req.params.id)); } catch (e) { err(res, e); } };
exports.deleteRule  = async (req, res) => { try { await RuleService.remove(req.params.id); ok(res, { message: 'Deleted' }); } catch (e) { err(res, e, 404); } };

// ── Voting ────────────────────────────────────────────────────────────────
exports.getVoteSessions = async (req, res) => { try { ok(res, await VotingService.getAll()); } catch (e) { err(res, e, 500); } };
exports.voteManual = async (req, res) => {
  try {
    const { method, data } = req.body;
    if (!method || !data) return err(res, new Error('method and data required'));
    ok(res, await VotingService.voteManual(method, data), 201);
  } catch (e) { err(res, e); }
};
exports.importVoteCSV = async (req, res) => {
  try {
    if (!req.file) return err(res, new Error('CSV file required'));
    if (!req.body.method) return err(res, new Error('method required'));
    ok(res, await VotingService.importFromCSVBuffer(req.body.method, req.file.buffer), 201);
  } catch (e) { err(res, e); }
};
exports.importVoteSheets = async (req, res) => {
  try {
    const { method, url } = req.body;
    if (!method || !url) return err(res, new Error('method and url required'));
    ok(res, await VotingService.importFromGoogleSheets(method, url), 201);
  } catch (e) { err(res, e); }
};
exports.applyVoteSession = async (req, res) => { try { ok(res, await VotingService.applySessionToCriteria(req.params.id)); } catch (e) { err(res, e); } };
