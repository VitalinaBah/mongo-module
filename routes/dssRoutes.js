const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/dssController');

const upload = multer({ storage: multer.memoryStorage() });

// ── Alternatives ──────────────────────────────────────────────────────────
router.get('/alternatives',                         ctrl.getAlternatives);
router.post('/alternatives',                        ctrl.createAlternative);
router.put('/alternatives/:id',                     ctrl.updateAlternative);
router.delete('/alternatives/:id',                  ctrl.deleteAlternative);
router.patch('/alternatives/:id/score/:criteriaId', ctrl.setScore);

// ── Criteria ──────────────────────────────────────────────────────────────
router.get('/criteria',              ctrl.getCriteria);
router.post('/criteria',             ctrl.createCriteria);
router.put('/criteria/:id',          ctrl.updateCriteria);
router.delete('/criteria/:id',       ctrl.deleteCriteria);
router.get('/criteria/validate',     ctrl.validateWeights);

// ── Matrix ────────────────────────────────────────────────────────────────
router.get('/matrix',                ctrl.getMatrix);

// ── Analysis (СППР) ───────────────────────────────────────────────────────
router.get('/analyze',                       ctrl.analyze);
router.get('/analyze/all',                   ctrl.analyzeAll);
router.get('/sensitivity/:criteriaId',       ctrl.sensitivity);
router.get('/decisions',                     ctrl.getDecisionHistory);

// ── Rules (Експертна логіка IF-THEN) ──────────────────────────────────────
router.get('/rules',                 ctrl.getRules);
router.post('/rules',                ctrl.createRule);
router.put('/rules/:id',             ctrl.updateRule);
router.patch('/rules/:id/toggle',    ctrl.toggleRule);
router.delete('/rules/:id',          ctrl.deleteRule);

// ── Experts (Експертиза + CSV-імпорт) ─────────────────────────────────────
router.get('/experts',                       ctrl.getExperts);
router.post('/experts',                      ctrl.createExpert);
router.delete('/experts/:id',                ctrl.deleteExpert);
router.post('/experts/import', upload.single('file'), ctrl.importExpertCSV);
router.get('/experts/aggregate',             ctrl.aggregateExperts);

module.exports = router;
