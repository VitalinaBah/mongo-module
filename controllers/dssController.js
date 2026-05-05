const AlternativeService = require('../services/AlternativeService');
const CriteriaService = require('../services/CriteriaService');
const AnalyticsService = require('../services/AnalyticsService');
const RuleService = require('../services/RuleService');
const ExpertService = require('../services/ExpertService');

// ── Alternatives ──────────────────────────────────────────────────────────

exports.getAlternatives = async (req, res) => {
  try {
    const data = await AlternativeService.getAll();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.createAlternative = async (req, res) => {
  try {
    const data = await AlternativeService.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.updateAlternative = async (req, res) => {
  try {
    const data = await AlternativeService.update(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.setScore = async (req, res) => {
  try {
    const { id, criteriaId } = req.params;
    const { score } = req.body;
    if (score === undefined) return res.status(400).json({ success: false, error: 'score required' });
    const data = await AlternativeService.setScore(id, criteriaId, Number(score));
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.deleteAlternative = async (req, res) => {
  try {
    await AlternativeService.remove(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    res.status(404).json({ success: false, error: e.message });
  }
};

// ── Criteria ──────────────────────────────────────────────────────────────

exports.getCriteria = async (req, res) => {
  try {
    const data = await CriteriaService.getAll();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.createCriteria = async (req, res) => {
  try {
    const data = await CriteriaService.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.updateCriteria = async (req, res) => {
  try {
    const data = await CriteriaService.update(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.deleteCriteria = async (req, res) => {
  try {
    await CriteriaService.remove(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    res.status(404).json({ success: false, error: e.message });
  }
};

exports.validateWeights = async (req, res) => {
  try {
    const result = await CriteriaService.validateWeights();
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Analytics ─────────────────────────────────────────────────────────────

exports.analyze = async (req, res) => {
  try {
    const method = req.query.method || 'SAW';
    const applyRules = req.query.applyRules === 'true';
    let result = await AnalyticsService.analyze(method);
    if (applyRules) {
      const r = await AnalyticsService.applyRules(result.ranking);
      result = { ...result, ranking: r.ranking, rulesApplied: r.applied };
    }
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.analyzeAll = async (req, res) => {
  try {
    const result = await AnalyticsService.analyzeAll();
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.sensitivity = async (req, res) => {
  try {
    const { criteriaId } = req.params;
    const { method = 'SAW', weights } = req.query;
    const range = weights
      ? weights.split(',').map(Number)
      : [0.05, 0.15, 0.25, 0.35, 0.45, 0.55];
    const result = await AnalyticsService.sensitivity(criteriaId, range, method);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.getDecisionHistory = async (req, res) => {
  try {
    const data = await AnalyticsService.getHistory();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Matrix view ───────────────────────────────────────────────────────────

exports.getMatrix = async (req, res) => {
  try {
    const criteriaList = await CriteriaService.getAll();
    const criteriaIds = criteriaList.map(c => c._id.toString());
    const matrix = await AlternativeService.getMatrix(criteriaIds);
    res.json({
      success: true,
      data: {
        criteria: criteriaList,
        matrix
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Rules (Експертна логіка) ──────────────────────────────────────────────

exports.getRules = async (req, res) => {
  try {
    const data = await RuleService.getAll();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.createRule = async (req, res) => {
  try {
    const data = await RuleService.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const data = await RuleService.update(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.toggleRule = async (req, res) => {
  try {
    const data = await RuleService.toggle(req.params.id);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    await RuleService.remove(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    res.status(404).json({ success: false, error: e.message });
  }
};

// ── Experts (Експертиза) ──────────────────────────────────────────────────

exports.getExperts = async (req, res) => {
  try {
    const data = await ExpertService.getAll();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.createExpert = async (req, res) => {
  try {
    const data = await ExpertService.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.deleteExpert = async (req, res) => {
  try {
    await ExpertService.remove(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    res.status(404).json({ success: false, error: e.message });
  }
};

exports.importExpertCSV = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'CSV file required (field: file)' });
    const result = await ExpertService.importCSV(req.file.buffer);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

exports.aggregateExperts = async (req, res) => {
  try {
    const method = req.query.method || 'average';
    const data = await ExpertService.aggregate(method);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};
