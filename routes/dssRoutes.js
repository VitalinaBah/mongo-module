const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/dssController');
const multer   = require('multer');
const upload   = multer({ storage: multer.memoryStorage() });

// ── Alternatives ──────────────────────────────────────────────────────────
router.get('/alternatives',                          ctrl.getAlternatives);
router.post('/alternatives',                         ctrl.createAlternative);
router.delete('/alternatives/:id',                   ctrl.deleteAlternative);
router.patch('/alternatives/:id/score/:criteriaId',  ctrl.setScore);

// ── Criteria ──────────────────────────────────────────────────────────────
router.get('/criteria',              ctrl.getCriteria);
router.post('/criteria',             ctrl.createCriteria);
router.patch('/criteria/:id',        ctrl.updateCriteria);
router.delete('/criteria/:id',       ctrl.deleteCriteria);
router.get('/criteria/validate',     ctrl.validateWeights);

// ── Matrix ────────────────────────────────────────────────────────────────
router.get('/matrix', ctrl.getMatrix);

// ── Analysis ──────────────────────────────────────────────────────────────
router.get('/analyze',        ctrl.analyze);
router.get('/analyze/all',    ctrl.analyzeAll);
router.get('/sensitivity',    ctrl.sensitivity);
router.post('/scenarios',     ctrl.scenarios);
router.get('/stability',      ctrl.stability);
router.get('/decisions',      ctrl.getDecisionHistory);

// ── Experts ───────────────────────────────────────────────────────────────
router.get('/experts',                      ctrl.getExperts);
router.post('/experts/import/csv',          upload.single('file'), ctrl.importExpertsCSV);
router.post('/experts/import/sheets',       ctrl.importExpertsSheets);
router.get('/experts/aggregate',            ctrl.aggregateExperts);
router.post('/experts/apply',               ctrl.applyAggregated);
router.delete('/experts/:id',               ctrl.deleteExpert);

// ── Rules ─────────────────────────────────────────────────────────────────
router.get('/rules',              ctrl.getRules);
router.post('/rules',             ctrl.createRule);
router.patch('/rules/:id',        ctrl.updateRule);
router.patch('/rules/:id/toggle', ctrl.toggleRule);
router.delete('/rules/:id',       ctrl.deleteRule);

// ── Voting ────────────────────────────────────────────────────────────────
router.get('/votes',                       ctrl.getVoteSessions);
router.post('/votes/manual',               ctrl.voteManual);
router.post('/votes/import/csv',           upload.single('file'), ctrl.importVoteCSV);
router.post('/votes/import/sheets',        ctrl.importVoteSheets);
router.post('/votes/:id/apply',            ctrl.applyVoteSession);

module.exports = router;
