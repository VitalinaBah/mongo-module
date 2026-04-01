const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dssController');

// ── Alternatives ──────────────────────────────────────────────────────────
router.get('/alternatives',                         ctrl.getAlternatives);
router.post('/alternatives',                        ctrl.createAlternative);
router.delete('/alternatives/:id',                  ctrl.deleteAlternative);
router.patch('/alternatives/:id/score/:criteriaId', ctrl.setScore);

// ── Criteria ──────────────────────────────────────────────────────────────
router.get('/criteria',              ctrl.getCriteria);
router.post('/criteria',             ctrl.createCriteria);
router.delete('/criteria/:id',       ctrl.deleteCriteria);
router.get('/criteria/validate',     ctrl.validateWeights);

// ── Matrix ────────────────────────────────────────────────────────────────
router.get('/matrix',                ctrl.getMatrix);

// ── Analysis (СППР) ───────────────────────────────────────────────────────
// ?method=WSM | SAW | TOPSIS
router.get('/analyze',               ctrl.analyze);
router.get('/analyze/all',           ctrl.analyzeAll);
router.get('/decisions',             ctrl.getDecisionHistory);

module.exports = router;
