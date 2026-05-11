/* ═══════════════════════════════════════════════════════════════
   СППР SPA — app.js
   Чотири екрани: Експертиза / Модель / Правила / Результати
═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Стан ────────────────────────────────────────────────────────
let currentMethod = 'SAW';
let barChartInst  = null;
let radarChartInst = null;
let sensChartInst = null;
let scenarioCount = 0;
let criteriaCache = [];
let alternativesCache = [];

// ── Вкладки ─────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

    // Підвантажити дані при переході
    if (btn.dataset.tab === 'expertise')  { loadExperts(); loadVoteSessions(); }
    if (btn.dataset.tab === 'model')      { loadCriteria(); loadAlternatives(); loadMatrix(); }
    if (btn.dataset.tab === 'rules')      { loadRules(); loadThresholds(); }
    if (btn.dataset.tab === 'results')    { populateSensCriteria(); populateRuleCriteria(); }
  });
});

// ── Helpers ──────────────────────────────────────────────────────
const api = async (url, options = {}) => {
  const res  = await fetch(url, options);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
};

function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function fmtScore(v) { return typeof v === 'number' ? v.toFixed(4) : v; }

// ══════════════════════════════════════════════════════════════════
//  ЕКРАН 1 — ЕКСПЕРТИЗА
// ══════════════════════════════════════════════════════════════════

async function loadExperts() {
  try {
    const experts = await api('/api/experts');
    const tbody   = document.getElementById('expertsBody');
    tbody.innerHTML = experts.length === 0
      ? '<tr><td colspan="5" class="hint" style="text-align:center;padding:16px">Немає завантажених експертів</td></tr>'
      : experts.map(e => `
        <tr>
          <td>${e.name}</td>
          <td><span class="badge badge-blue">${e.source}</span></td>
          <td>${e.ratings?.length ?? 0}</td>
          <td>${e.weight ?? 1}</td>
          <td><button class="btn-sm btn-red" onclick="deleteExpert('${e._id}')">✕</button></td>
        </tr>`).join('');
  } catch(ex) { toast(ex.message, true); }
}

async function importExpertsSheets() {
  const url = document.getElementById('expertSheetsUrl').value.trim();
  if (!url) return toast('Введіть URL таблиці', true);
  try {
    const res = await api('/api/experts/import/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    toast(`Імпортовано ${res.length} експертів`);
    loadExperts();
  } catch(ex) { toast(ex.message, true); }
}

async function importExpertsCSV() {
  const file = document.getElementById('expertCSV').files[0];
  if (!file) return toast('Виберіть CSV-файл', true);
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await api('/api/experts/import/csv', { method: 'POST', body: fd });
    toast(`Імпортовано ${res.length} експертів`);
    loadExperts();
  } catch(ex) { toast(ex.message, true); }
}

async function aggregateExperts() {
  const method = document.getElementById('aggregMethod').value;
  try {
    const data = await api(`/api/experts/aggregate?method=${method}`);
    const byAlt = {};
    data.forEach(r => {
      if (!byAlt[r.alternativeName]) byAlt[r.alternativeName] = {};
      byAlt[r.alternativeName][r.criteriaName] = r.score;
    });
    const crits = [...new Set(data.map(r => r.criteriaName))];
    const alts  = Object.keys(byAlt);
    const html  = `<table>
      <thead><tr><th>Альт.</th>${crits.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${alts.map(a =>
        `<tr><td>${a}</td>${crits.map(c => `<td>${byAlt[a][c] ?? '—'}</td>`).join('')}</tr>`
      ).join('')}</tbody>
    </table>`;
    document.getElementById('aggregResult').innerHTML = html;
    toast('Узгоджені оцінки отримано (preview)');
  } catch(ex) { toast(ex.message, true); }
}

async function applyAggregated() {
  const method = document.getElementById('aggregMethod').value;
  try {
    const res = await api('/api/experts/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method })
    });
    toast(`Застосовано ${res.length} оцінок до альтернатив`);
    loadMatrix();
  } catch(ex) { toast(ex.message, true); }
}

async function deleteExpert(id) {
  if (!confirm('Видалити експерта?')) return;
  try { await api(`/api/experts/${id}`, { method: 'DELETE' }); toast('Видалено'); loadExperts(); }
  catch(ex) { toast(ex.message, true); }
}

// ── Голосування ──────────────────────────────────────────────────

async function loadVoteSessions() {
  try {
    const sessions = await api('/api/votes');
    const tbody = document.getElementById('votesBody');
    tbody.innerHTML = sessions.length === 0
      ? '<tr><td colspan="5" class="hint" style="text-align:center;padding:16px">Немає сесій голосування</td></tr>'
      : sessions.map(s => `
        <tr>
          <td>${new Date(s.createdAt).toLocaleDateString('uk')}</td>
          <td><span class="badge badge-blue">${s.method}</span></td>
          <td>${s.source}</td>
          <td>${s.results.map(r => `${r.criteriaName}: <b>${r.weight}</b>`).join(', ')}</td>
          <td><button class="btn-sm btn-green" onclick="applyVoteSession('${s._id}')">Застосувати</button></td>
        </tr>`).join('');
  } catch(ex) { toast(ex.message, true); }
}

async function importVoteSheets() {
  const method = document.getElementById('voteMethodSheets').value;
  const url    = document.getElementById('voteSheetsUrl').value.trim();
  if (!url) return toast('Введіть URL таблиці', true);
  try {
    await api('/api/votes/import/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, url })
    });
    toast('Голосування імпортовано'); loadVoteSessions();
  } catch(ex) { toast(ex.message, true); }
}

async function importVoteCSV() {
  const method = document.getElementById('voteMethodCSV').value;
  const file   = document.getElementById('voteCSV').files[0];
  if (!file) return toast('Виберіть CSV-файл', true);
  const fd = new FormData();
  fd.append('file', file);
  fd.append('method', method);
  try {
    await api('/api/votes/import/csv', { method: 'POST', body: fd });
    toast('Голосування імпортовано'); loadVoteSessions();
  } catch(ex) { toast(ex.message, true); }
}

async function applyVoteSession(id) {
  try {
    const res = await api(`/api/votes/${id}/apply`, { method: 'POST' });
    toast(`Ваги оновлено для ${res.length} критеріїв`);
    loadCriteria();
  } catch(ex) { toast(ex.message, true); }
}

// ══════════════════════════════════════════════════════════════════
//  ЕКРАН 2 — МОДЕЛЬ ТА ДАНІ
// ══════════════════════════════════════════════════════════════════

async function loadCriteria() {
  try {
    criteriaCache = await api('/api/criteria');
    const tbody   = document.getElementById('criteriaBody');
    tbody.innerHTML = criteriaCache.map(c => `
      <tr>
        <td>${c.name}</td>
        <td><span class="badge ${c.type === 'maximize' ? 'badge-ok' : 'badge-err'}">${c.type}</span></td>
        <td>
          <input type="number" class="cell-score" value="${c.weight}" step="0.01" min="0" max="1"
            onchange="updateCriteria('${c._id}', {weight: parseFloat(this.value)})">
        </td>
        <td>
          <input type="number" class="cell-score" value="${c.threshold ?? ''}" placeholder="—" step="any"
            onchange="updateCriteria('${c._id}', {threshold: this.value === '' ? null : parseFloat(this.value)})">
        </td>
        <td><button class="btn-sm btn-red" onclick="deleteCriteria('${c._id}')">✕</button></td>
      </tr>`).join('');
    updateWeightsStatus();
    populateRuleCriteria();
    populateSensCriteria();
  } catch(ex) { toast(ex.message, true); }
}

async function updateWeightsStatus() {
  try {
    const v = await api('/api/criteria/validate');
    const el = document.getElementById('weightsStatus');
    el.textContent = `Сума ваг: ${v.sum.toFixed(3)} ${v.valid ? '✓' : '✗'}`;
    el.className   = `badge ${v.valid ? 'badge-ok' : 'badge-err'}`;
  } catch(ex) {}
}

async function addCriteria(e) {
  e.preventDefault();
  const body = {
    name:      document.getElementById('cName').value.trim(),
    type:      document.getElementById('cType').value,
    weight:    parseFloat(document.getElementById('cWeight').value),
    threshold: document.getElementById('cThreshold').value === '' ? null : parseFloat(document.getElementById('cThreshold').value)
  };
  try {
    await api('/api/criteria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    toast('Критерій додано');
    e.target.reset();
    loadCriteria();
  } catch(ex) { toast(ex.message, true); }
}

async function updateCriteria(id, patch) {
  try {
    await api(`/api/criteria/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    updateWeightsStatus();
    populateSensCriteria();
  } catch(ex) { toast(ex.message, true); }
}

async function deleteCriteria(id) {
  if (!confirm('Видалити критерій?')) return;
  try { await api(`/api/criteria/${id}`, { method: 'DELETE' }); toast('Видалено'); loadCriteria(); loadMatrix(); }
  catch(ex) { toast(ex.message, true); }
}

// ── Альтернативи ─────────────────────────────────────────────────

async function loadAlternatives() {
  try {
    alternativesCache = await api('/api/alternatives');
    const ul = document.getElementById('altsList');
    ul.innerHTML = alternativesCache.map(a => `
      <li style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9">
        <span style="flex:1;font-weight:600">${a.name}</span>
        <span style="color:#9ca3af;font-size:.82rem">${a.description || ''}</span>
        <button class="btn-sm btn-red" onclick="deleteAlternative('${a._id}')">✕</button>
      </li>`).join('');
  } catch(ex) { toast(ex.message, true); }
}

async function addAlternative(e) {
  e.preventDefault();
  const body = { name: document.getElementById('aName').value.trim(), description: document.getElementById('aDesc').value.trim() };
  try {
    await api('/api/alternatives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    toast('Альтернативу додано'); e.target.reset();
    loadAlternatives(); loadMatrix();
  } catch(ex) { toast(ex.message, true); }
}

async function deleteAlternative(id) {
  if (!confirm('Видалити альтернативу?')) return;
  try { await api(`/api/alternatives/${id}`, { method: 'DELETE' }); toast('Видалено'); loadAlternatives(); loadMatrix(); }
  catch(ex) { toast(ex.message, true); }
}

// ── Матриця ──────────────────────────────────────────────────────

async function loadMatrix() {
  try {
    const { criteria, matrix } = await api('/api/matrix');
    const container = document.getElementById('matrixContainer');
    if (!criteria.length || !matrix.length) {
      container.innerHTML = '<p class="hint" style="padding:16px">Немає даних для матриці.</p>';
      return;
    }
    const head = `<table><thead><tr><th>Альтернатива</th>${criteria.map(c =>
      `<th>${c.name}<br><small style="color:#9ca3af">${c.type} | ${c.weight}</small></th>`).join('')}</tr></thead><tbody>`;
    const rows = matrix.map(alt => {
      const cells = criteria.map((c, j) => {
        const cIdStr = c._id.toString();
        const score  = Array.isArray(alt.scores) ? (alt.scores[j] ?? '') : (alt.scores[cIdStr] ?? '');
        return `<td><input type="number" class="cell-score" value="${score}" step="any"
          onblur="setScore('${alt._id}','${cIdStr}',this.value)"></td>`;
      }).join('');
      return `<tr><td><b>${alt.name}</b></td>${cells}</tr>`;
    }).join('');
    container.innerHTML = head + rows + '</tbody></table>';
  } catch(ex) { toast(ex.message, true); }
}

async function setScore(altId, criteriaId, value) {
  if (value === '') return;
  try {
    await api(`/api/alternatives/${altId}/score/${criteriaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: parseFloat(value) })
    });
  } catch(ex) { toast(ex.message, true); }
}

// ══════════════════════════════════════════════════════════════════
//  ЕКРАН 3 — ПРАВИЛА
// ══════════════════════════════════════════════════════════════════

function populateRuleCriteria() {
  const sel = document.getElementById('rCriteria');
  if (!sel) return;
  sel.innerHTML = criteriaCache.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function toggleActionValue() {
  const action = document.getElementById('rAction').value;
  const inp    = document.getElementById('rActionValue');
  inp.style.display = (action === 'bonus' || action === 'penalty') ? '' : 'none';
  if (action === 'reject') inp.value = '';
}

async function addRule(e) {
  e.preventDefault();
  const body = {
    name:      document.getElementById('rName').value.trim(),
    description: document.getElementById('rDesc').value.trim(),
    condition: {
      criteriaName: document.getElementById('rCriteria').value,
      operator:     document.getElementById('rOperator').value,
      value:        parseFloat(document.getElementById('rValue').value)
    },
    action: {
      type:  document.getElementById('rAction').value,
      value: parseFloat(document.getElementById('rActionValue').value) || 0
    }
  };
  try {
    await api('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    toast('Правило додано'); e.target.reset(); toggleActionValue(); loadRules();
  } catch(ex) { toast(ex.message, true); }
}

async function loadRules() {
  try {
    const rules = await api('/api/rules');
    const tbody = document.getElementById('rulesBody');
    tbody.innerHTML = rules.length === 0
      ? '<tr><td colspan="5" class="hint" style="text-align:center;padding:16px">Немає правил</td></tr>'
      : rules.map(r => `
        <tr>
          <td><b>${r.name}</b><br><small style="color:#9ca3af">${r.description || ''}</small></td>
          <td>IF ${r.condition.criteriaName} ${r.condition.operator} ${r.condition.value}</td>
          <td>THEN ${r.action.type}${r.action.value ? ` (${r.action.value}%)` : ''}</td>
          <td>
            <label class="toggle"><input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleRule('${r._id}')">
            <span class="slider"></span></label>
          </td>
          <td><button class="btn-sm btn-red" onclick="deleteRule('${r._id}')">✕</button></td>
        </tr>`).join('');
  } catch(ex) { toast(ex.message, true); }
}

async function toggleRule(id) {
  try { await api(`/api/rules/${id}/toggle`, { method: 'PATCH' }); }
  catch(ex) { toast(ex.message, true); loadRules(); }
}

async function deleteRule(id) {
  if (!confirm('Видалити правило?')) return;
  try { await api(`/api/rules/${id}`, { method: 'DELETE' }); toast('Видалено'); loadRules(); }
  catch(ex) { toast(ex.message, true); }
}

async function loadThresholds() {
  try {
    const criteria = await api('/api/criteria');
    const tbody    = document.getElementById('thresholdsBody');
    tbody.innerHTML = criteria.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.type}</td>
        <td>${c.threshold != null ? c.threshold : '<span class="hint">—</span>'}</td>
      </tr>`).join('');
  } catch(ex) {}
}

// ══════════════════════════════════════════════════════════════════
//  ЕКРАН 4 — РЕЗУЛЬТАТИ
// ══════════════════════════════════════════════════════════════════

function setMethod(btn) {
  document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMethod = btn.dataset.method;
  document.getElementById('methodBadge').textContent = currentMethod;
}

async function runAnalysis() {
  const applyRules = document.getElementById('applyRulesChk').checked;
  try {
    const data = await api(`/api/analyze?method=${currentMethod}&rules=${applyRules}`);
    renderRanking(data);
    renderBarChart(data.ranking);
    document.getElementById('allMethodsCard').style.display = 'none';
    document.getElementById('stabilityCard').style.display  = 'none';
    toast(`Аналіз ${data.method} завершено`);
  } catch(ex) { toast(ex.message, true); }
}

function renderRanking(data) {
  const maxScore = Math.max(...data.ranking.map(r => r.score));
  document.getElementById('rankingList').innerHTML = data.ranking.map((r, i) => {
    const pct  = maxScore > 0 ? (r.score / maxScore * 100).toFixed(1) : 0;
    return `<li class="${i === 0 ? 'rank-1' : ''}">
      <span class="rank-num">${r.rank}</span>
      <span class="rank-name">${r.alternative}</span>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct}%"></div></div>
      <span class="rank-score">${fmtScore(r.score)}</span>
    </li>`;
  }).join('');
  document.getElementById('explanationBox').textContent = data.explanation;

  // Відкинуті пороговим фільтром
  const rejSec = document.getElementById('rejectedSection');
  const rejList = document.getElementById('rejectedList');
  if (data.rejectedByThreshold?.length) {
    rejSec.style.display = '';
    rejList.innerHTML = data.rejectedByThreshold.map(r =>
      `<li>${r.alternative} — <b>${r.criteria}</b>: ${r.actual} (поріг: ${r.threshold})</li>`
    ).join('');
  } else { rejSec.style.display = 'none'; }

  // Застосовані правила
  const ruleSec  = document.getElementById('appliedRulesSection');
  const ruleList = document.getElementById('appliedRulesList');
  if (data.appliedRules?.length) {
    ruleSec.style.display = '';
    ruleList.innerHTML = data.appliedRules.map(r =>
      `<li>[${r.rule}] ${r.alternative} → <b>${r.action}</b> (причина: ${r.reason})</li>`
    ).join('');
  } else { ruleSec.style.display = 'none'; }
}

function renderBarChart(ranking) {
  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ranking.map(r => r.alternative),
      datasets: [{
        label: 'Інтегральна оцінка',
        data: ranking.map(r => +r.score.toFixed(4)),
        backgroundColor: ['#f59e0b','#4361ee','#10b981','#a855f7','#ef4444','#06b6d4'],
        borderRadius: 6
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

async function runAllMethods() {
  try {
    const data = await api('/api/analyze/all');
    const methods  = Object.keys(data);
    const alts     = data[methods[0]].ranking.map(r => r.alternative);
    const card     = document.getElementById('allMethodsCard');
    card.style.display = '';

    // Таблиця
    const thead = `<thead><tr><th>Альтернатива</th>${methods.map(m => `<th>${m}</th>`).join('')}</tr></thead>`;
    const tbody = alts.map(alt => {
      const cells = methods.map(m => {
        const r = data[m].ranking.find(r => r.alternative === alt);
        return `<td class="${r?.rank === 1 ? 'best' : ''}">${r ? `#${r.rank} (${fmtScore(r.score)})` : '—'}</td>`;
      }).join('');
      return `<tr><td><b>${alt}</b></td>${cells}</tr>`;
    }).join('');
    document.getElementById('allMethodsTable').innerHTML =
      `<table class="compare-table">${thead}<tbody>${tbody}</tbody></table>`;

    // Radar chart — тільки SAW/TOPSIS/WSM (числові значення 0..1)
    const ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChartInst) radarChartInst.destroy();
    const colors = ['#4361ee','#10b981','#f59e0b','#a855f7','#ef4444'];
    radarChartInst = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: alts,
        datasets: methods.map((m, i) => ({
          label: m,
          data: alts.map(alt => {
            const r = data[m].ranking.find(r => r.alternative === alt);
            return r ? +r.score.toFixed(4) : 0;
          }),
          borderColor: colors[i],
          backgroundColor: colors[i] + '22',
          pointRadius: 4
        }))
      },
      options: { scales: { r: { beginAtZero: true } } }
    });

    // Показати перший результат у рейтингу
    renderRanking(data['SAW']);
    renderBarChart(data['SAW'].ranking);
    toast('Порівняння всіх методів готове');
  } catch(ex) { toast(ex.message, true); }
}

// ── Стабільність ─────────────────────────────────────────────────

async function loadStability() {
  try {
    const data = await api('/api/stability');
    const card = document.getElementById('stabilityCard');
    card.style.display = '';
    const methods = Object.keys(data.methods);
    const alts    = data.consensus.map(c => c.alternative);

    const thead = `<thead><tr><th>Альтернатива</th>${methods.map(m => `<th>${m}</th>`).join('')}<th>Середній ранг</th></tr></thead>`;
    const tbody = alts.map((alt, i) => {
      const cells = methods.map(m => {
        const r = data.methods[m].find(r => r.alternative === alt);
        return `<td>${r ? `#${r.rank}` : '—'}</td>`;
      }).join('');
      const avg = data.consensus[i].avgRank;
      return `<tr class="${i === 0 ? 'stability-row' : ''}"><td><b>${alt}</b></td>${cells}<td class="${i === 0 ? 'consensus-1' : ''}">${avg}</td></tr>`;
    }).join('');
    document.getElementById('stabilityContent').innerHTML = `<table>${thead}<tbody>${tbody}</tbody></table>`;
    toast('Аналіз стабільності готовий');
  } catch(ex) { toast(ex.message, true); }
}

// ── Чутливість ───────────────────────────────────────────────────

function populateSensCriteria() {
  const sel = document.getElementById('sensCriteria');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = criteriaCache.map(c => `<option value="${c.name}" ${c.name === current ? 'selected' : ''}>${c.name}</option>`).join('');
}

async function runSensitivity() {
  const criteria = document.getElementById('sensCriteria').value;
  const method   = document.getElementById('sensMethod').value;
  if (!criteria) return toast('Виберіть критерій', true);
  try {
    const data = await api(`/api/sensitivity?criteria=${encodeURIComponent(criteria)}&method=${method}&steps=20`);
    const alts  = data.points[0].scores.map(s => s.alternative);
    const ctx   = document.getElementById('sensChart').getContext('2d');
    if (sensChartInst) sensChartInst.destroy();
    const colors = ['#4361ee','#10b981','#f59e0b','#a855f7','#ef4444','#06b6d4'];
    sensChartInst = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.points.map(p => p.weight.toFixed(2)),
        datasets: alts.map((alt, i) => ({
          label: alt,
          data: data.points.map(p => p.scores.find(s => s.alternative === alt)?.score ?? 0),
          borderColor: colors[i % colors.length],
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 2
        }))
      },
      options: {
        plugins: { title: { display: true, text: `Чутливість: вага "${criteria}" → оцінки (${method})` } },
        scales: { x: { title: { display: true, text: `Вага: ${criteria}` } }, y: { title: { display: true, text: 'Оцінка' } } }
      }
    });
    toast('Аналіз чутливості побудовано');
  } catch(ex) { toast(ex.message, true); }
}

// ── Сценарний аналіз ─────────────────────────────────────────────

function addScenario() {
  scenarioCount++;
  const id  = scenarioCount;
  const div = document.createElement('div');
  div.className = 'scenario-row';
  div.id = `scenario-${id}`;
  const weightFields = criteriaCache.map(c => `
    <div class="scenario-weight-item">
      <label>${c.name}</label>
      <input type="number" class="sc-weight" data-criteria="${c.name}" value="${c.weight}" step="0.01" min="0" max="1">
    </div>`).join('');
  div.innerHTML = `
    <h4>Сценарій ${id}
      <button class="btn-sm btn-outline" style="margin-left:12px" onclick="document.getElementById('scenario-${id}').remove()">Видалити</button>
    </h4>
    <div class="row-inputs" style="margin-bottom:10px">
      <label>Назва:</label>
      <input type="text" class="sc-name" placeholder="Назва сценарію" value="Сценарій ${id}">
      <label>Метод:</label>
      <select class="sc-method">
        <option value="SAW">SAW</option><option value="WSM">WSM</option>
        <option value="TOPSIS">TOPSIS</option><option value="CAUTIOUS">CAUTIOUS</option>
        <option value="MULTIPLICATIVE">MULTIPLICATIVE</option>
      </select>
    </div>
    <div class="scenario-weights">${weightFields}</div>`;
  document.getElementById('scenariosBuilder').appendChild(div);
}

async function runScenarios() {
  const rows = document.querySelectorAll('.scenario-row');
  if (!rows.length) return toast('Додайте хоча б один сценарій', true);

  const scenarios = [...rows].map(row => {
    const weights = {};
    row.querySelectorAll('.sc-weight').forEach(inp => { weights[inp.dataset.criteria] = parseFloat(inp.value); });
    return {
      name:    row.querySelector('.sc-name').value.trim(),
      method:  row.querySelector('.sc-method').value,
      weights
    };
  });

  try {
    const results = await api('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarios })
    });
    const html = results.map(r => `
      <div class="scenario-result-card">
        <h4>${r.scenario} <span class="badge badge-blue">${r.method}</span> — Найкраща: <b>${r.best}</b></h4>
        <ol>${r.ranking.map(item => `<li>${item.alternative}: ${fmtScore(item.score)}</li>`).join('')}</ol>
      </div>`).join('');
    document.getElementById('scenariosResult').innerHTML = html;
    toast('Сценарії порівняно');
  } catch(ex) { toast(ex.message, true); }
}

// ══════════════════════════════════════════════════════════════════
//  ІНІЦІАЛІЗАЦІЯ
// ══════════════════════════════════════════════════════════════════
(async function init() {
  try {
    criteriaCache     = await api('/api/criteria');
    alternativesCache = await api('/api/alternatives');
    loadExperts();
    loadVoteSessions();
    populateRuleCriteria();
    populateSensCriteria();
  } catch(ex) { console.error('Init error:', ex); }
})();
