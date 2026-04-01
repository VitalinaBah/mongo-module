const AlternativeService = require('../services/AlternativeService');
const CriteriaService = require('../services/CriteriaService');
const AnalyticsService = require('../services/AnalyticsService');

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
    const result = await AnalyticsService.analyze(method);
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
