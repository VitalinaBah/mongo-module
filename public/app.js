/* СППР — Лабораторна 1
 * Frontend SPA: 4 екрани (Експертиза, Модель, Правила, Результати)
 */

const API = '/api';
let state = {
  criteria: [],
  alternatives: [],
  rules: [],
  experts: [],
  currentMethod: 'SAW'
};
let charts = { bar: null, radar: null, sens: null };

// ── Screen switching ──────────────────────────────────────────
document.querySelectorAll('.screen-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.screen-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`screen-${tab.dataset.screen}`).classList.add('active');
    onScreenChange(tab.dataset.screen);
  });
});

function onScreenChange(screen) {
  if (screen === 'expertise') loadExperts();
  if (screen === 'model')     loadModel();
  if (screen === 'rules')     loadRules();
  if (screen === 'results')   loadResults();
}

// ── HTTP helper ──────────────────────────────────────────────
async function api(path, options = {}) {
  const r = await fetch(API + path, options);
  const j = await r.json();
  if (!j.success) throw new Error(j.error || 'API error');
  return j.data;
}

// ─────────────────────────────────────────────────────────────
// ЕКРАН 1: ЕКСПЕРТИЗА
// ─────────────────────────────────────────────────────────────
async function loadExperts() {
  try {
    state.experts = await api('/experts');
    renderExpertsList();
  } catch (e) {
    document.getElementById('experts-list').innerHTML = `<div class="error">${e.message}</div>`;
  }
}

function renderExpertsList() {
  const el = document.getElementById('experts-list');
  if (state.experts.length === 0) {
    el.innerHTML = '<div class="list-empty">Експерти не завантажені</div>';
    el.className = 'list-empty';
    return;
  }
  el.className = '';
  el.innerHTML = state.experts.map(e => `
    <div class="list-item">
      <strong>${e.name}</strong>
      <span class="tag">${e.source}</span>
      <span class="small">${e.scores.length} оцінок</span>
      <button class="btn-danger" data-id="${e._id}" data-action="delete-expert">×</button>
    </div>
  `).join('');
}

document.getElementById('csv-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const file = document.getElementById('csv-file').files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  const status = document.getElementById('csv-status');
  status.className = 'status';
  status.textContent = 'Імпорт…';
  try {
    const result = await api('/experts/import', { method: 'POST', body: fd });
    status.className = 'status ok';
    status.textContent = `Успішно імпортовано ${result.imported} експертів`;
    loadExperts();
  } catch (e) {
    status.className = 'status err';
    status.textContent = `Помилка: ${e.message}`;
  }
});

document.getElementById('btn-aggregate').addEventListener('click', async () => {
  const method = document.getElementById('agg-method').value;
  const out = document.getElementById('agg-result');
  try {
    const data = await api(`/experts/aggregate?method=${method}`);
    out.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    out.textContent = `Помилка: ${e.message}`;
  }
});

document.getElementById('experts-list').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-action="delete-expert"]');
  if (!btn) return;
  if (!confirm('Видалити експерта?')) return;
  await api(`/experts/${btn.dataset.id}`, { method: 'DELETE' });
  loadExperts();
});

// ─────────────────────────────────────────────────────────────
// ЕКРАН 2: МОДЕЛЬ ТА ДАНІ
// ─────────────────────────────────────────────────────────────
async function loadModel() {
  try {
    state.criteria = await api('/criteria');
    state.alternatives = await api('/alternatives');
    renderCriteria();
    renderAlternatives();
    renderMatrix();
    validateWeights();
  } catch (e) {
    console.error(e);
  }
}

function renderCriteria() {
  const el = document.getElementById('criteria-list');
  if (state.criteria.length === 0) {
    el.innerHTML = '<div class="list-empty">Немає критеріїв</div>';
    return;
  }
  el.innerHTML = state.criteria.map(c => `
    <div class="list-item">
      <strong>${c.name}</strong>
      <span class="tag ${c.type}">${c.type}</span>
      <span class="small">вага: ${c.weight}</span>
      <button class="btn-danger" data-id="${c._id}" data-action="del-crit">×</button>
    </div>
  `).join('');
}

function renderAlternatives() {
  const el = document.getElementById('alternatives-list');
  if (state.alternatives.length === 0) {
    el.innerHTML = '<div class="list-empty">Немає альтернатив</div>';
    return;
  }
  el.innerHTML = state.alternatives.map(a => `
    <div class="list-item">
      <strong>${a.name}</strong>
      <span class="small">${a.description || ''}</span>
      <button class="btn-danger" data-id="${a._id}" data-action="del-alt">×</button>
    </div>
  `).join('');
}

async function renderMatrix() {
  const data = await api('/matrix');
  const { criteria, matrix } = data;
  if (criteria.length === 0 || matrix.length === 0) {
    document.getElementById('matrix-table').innerHTML = '<div class="list-empty">Додайте критерії та альтернативи</div>';
    return;
  }
  const head = `<tr><th>Альтернатива</th>${criteria.map(c => `<th>${c.name}</th>`).join('')}</tr>`;
  const rows = matrix.map(alt => `
    <tr>
      <td><strong>${alt.name}</strong></td>
      ${alt.scores.map((s, j) => `
        <td>
          <input class="cell-input" type="number" step="any"
                 data-alt="${alt.id}" data-crit="${criteria[j]._id}" value="${s}" />
        </td>
      `).join('')}
    </tr>
  `).join('');
  document.getElementById('matrix-table').innerHTML = `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;

  document.querySelectorAll('.cell-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      try {
        await api(`/alternatives/${inp.dataset.alt}/score/${inp.dataset.crit}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: Number(inp.value) })
        });
      } catch (e) { alert(e.message); }
    });
  });
}

async function validateWeights() {
  const r = await api('/criteria/validate');
  const el = document.getElementById('weights-validation');
  el.className = `status ${r.valid ? 'ok' : 'warn'}`;
  el.textContent = `Сума ваг: ${r.sum.toFixed(3)} ${r.valid ? '✓' : '(має бути ≈ 1)'}`;
}

document.getElementById('criteria-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  await api('/criteria', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: document.getElementById('crit-name').value,
      type: document.getElementById('crit-type').value,
      weight: Number(document.getElementById('crit-weight').value)
    })
  });
  ev.target.reset();
  loadModel();
});

document.getElementById('alt-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  await api('/alternatives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: document.getElementById('alt-name').value,
      description: document.getElementById('alt-desc').value
    })
  });
  ev.target.reset();
  loadModel();
});

document.getElementById('criteria-list').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-action="del-crit"]');
  if (!btn || !confirm('Видалити критерій?')) return;
  await api(`/criteria/${btn.dataset.id}`, { method: 'DELETE' });
  loadModel();
});

document.getElementById('alternatives-list').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-action="del-alt"]');
  if (!btn || !confirm('Видалити альтернативу?')) return;
  await api(`/alternatives/${btn.dataset.id}`, { method: 'DELETE' });
  loadModel();
});

// ─────────────────────────────────────────────────────────────
// ЕКРАН 3: ПРАВИЛА (IF-THEN)
// ─────────────────────────────────────────────────────────────
async function loadRules() {
  try {
    state.rules = await api('/rules');
    if (state.criteria.length === 0) state.criteria = await api('/criteria');
    renderCondCriteria();
    renderRulesList();
  } catch (e) { console.error(e); }
}

function renderCondCriteria() {
  const sel = document.getElementById('cond-criteria');
  sel.innerHTML = state.criteria.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
}

function renderRulesList() {
  const el = document.getElementById('rules-list');
  if (state.rules.length === 0) {
    el.innerHTML = '<div class="list-empty">Правил ще немає</div>';
    el.className = 'list-empty';
    return;
  }
  el.className = '';
  el.innerHTML = state.rules.map(r => {
    const conds = r.conditions.map(c => {
      const crit = state.criteria.find(x => x._id === c.criteriaId) || { name: '?' };
      return `${crit.name} ${c.operator} ${c.value}`;
    }).join(` ${r.combinator} `);
    return `
      <div class="list-item">
        <span style="${r.enabled ? '' : 'opacity:0.5'}">
          <strong>${r.name}</strong> — IF ${conds || '(порожньо)'}
          THEN <span class="tag">${r.action.type}${r.action.value ? `(${r.action.value})` : ''}</span>
        </span>
        <button class="btn-secondary" data-id="${r._id}" data-action="toggle-rule">
          ${r.enabled ? 'Вимкнути' : 'Увімкнути'}
        </button>
        <button class="btn-danger" data-id="${r._id}" data-action="del-rule">×</button>
      </div>
    `;
  }).join('');
}

document.getElementById('rule-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const body = {
    name: document.getElementById('rule-name').value,
    description: document.getElementById('rule-desc').value,
    conditions: [{
      criteriaId: document.getElementById('cond-criteria').value,
      operator:   document.getElementById('cond-op').value,
      value:      Number(document.getElementById('cond-value').value)
    }],
    combinator: 'AND',
    action: {
      type: document.getElementById('rule-action').value,
      value: Number(document.getElementById('rule-action-value').value || 0)
    }
  };
  await api('/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  ev.target.reset();
  loadRules();
});

document.getElementById('rules-list').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  if (btn.dataset.action === 'toggle-rule') {
    await api(`/rules/${btn.dataset.id}/toggle`, { method: 'PATCH' });
    loadRules();
  } else if (btn.dataset.action === 'del-rule') {
    if (!confirm('Видалити правило?')) return;
    await api(`/rules/${btn.dataset.id}`, { method: 'DELETE' });
    loadRules();
  }
});

// ─────────────────────────────────────────────────────────────
// ЕКРАН 4: РЕЗУЛЬТАТИ ТА АНАЛІЗ
// ─────────────────────────────────────────────────────────────
async function loadResults() {
  if (state.criteria.length === 0) state.criteria = await api('/criteria');
  // Заповнити селектор критеріїв для аналізу чутливості
  const sel = document.getElementById('sens-criteria');
  sel.innerHTML = state.criteria.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  renderResults(state.currentMethod);
}

document.querySelectorAll('#screen-results .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#screen-results .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentMethod = tab.dataset.method;
    renderResults(state.currentMethod);
  });
});

document.getElementById('apply-rules-checkbox').addEventListener('change', () => {
  renderResults(state.currentMethod);
});

async function renderResults(method) {
  const el = document.getElementById('results-content');
  el.innerHTML = '<div class="loading">Завантаження…</div>';
  try {
    if (method === 'ALL') {
      const all = await api('/analyze/all');
      el.innerHTML = renderComparison(all);
      setTimeout(() => drawRadar(all), 50);
    } else {
      const applyRules = document.getElementById('apply-rules-checkbox').checked;
      const data = await api(`/analyze?method=${method}&applyRules=${applyRules}`);
      el.innerHTML = renderSingle(method, data);
      setTimeout(() => drawBar(data.ranking), 50);
    }
  } catch (e) {
    el.innerHTML = `<div class="error">Помилка: ${e.message}</div>`;
  }
}

function rankClass(rank) {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
}

function renderSingle(method, data) {
  const max = Math.max(...data.ranking.map(r => Math.abs(r.score))) || 1;
  const items = data.ranking.map(r => `
    <li>
      <div class="rank-num ${rankClass(r.rank)}">${r.rank}</div>
      <span style="min-width:130px">${r.alternative}</span>
      <div class="rank-bar"><div class="rank-bar-fill" style="width:${(Math.abs(r.score)/max*100).toFixed(1)}%"></div></div>
      <span class="rank-score">${r.score.toFixed(4)}</span>
    </li>`).join('');

  const rulesInfo = data.rulesApplied && data.rulesApplied.length
    ? `<div class="explanation"><strong>Спрацювали правила:</strong> ${data.rulesApplied.map(r =>
        `${r.alternative}: ${r.rules.join(', ')}${r.rejected ? ' (відхилено)' : ''}`
      ).join(' · ')}</div>`
    : '';

  return `
    <div class="grid-2">
      <div class="card">
        <div class="best-badge">★ Найкраща альтернатива: ${data.best}</div>
        <h3>Рейтинг (${method})</h3>
        <ul class="ranking">${items}</ul>
        <div class="explanation">${data.explanation}</div>
        ${rulesInfo}
      </div>
      <div class="card">
        <h3>Інтегральні оцінки</h3>
        <canvas id="bar-chart"></canvas>
      </div>
    </div>`;
}

function renderComparison(all) {
  const methods = Object.keys(all);
  const alts = all[methods[0]].ranking.map(r => r.alternative);
  const rows = alts.map(alt => {
    const cells = methods.map(m => {
      const r = all[m].ranking.find(x => x.alternative === alt);
      const isBest = all[m].best === alt;
      return `<td style="${isBest ? 'font-weight:600;color:#166534' : ''}">#${r.rank} (${r.score.toFixed(3)})</td>`;
    }).join('');
    return `<tr><td><strong>${alt}</strong></td>${cells}</tr>`;
  }).join('');

  return `
    <div class="card">
      <h3>Порівняння методів</h3>
      <div class="matrix-wrap">
        <table>
          <thead><tr><th>Альтернатива</th>${methods.map(m => `<th>${m}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h3>Радарна діаграма</h3>
      <canvas id="radar-chart" style="max-height:340px"></canvas>
    </div>`;
}

function drawBar(ranking) {
  if (charts.bar) charts.bar.destroy();
  const ctx = document.getElementById('bar-chart');
  if (!ctx) return;
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ranking.map(r => r.alternative),
      datasets: [{
        label: 'Оцінка',
        data: ranking.map(r => parseFloat(r.score.toFixed(4))),
        backgroundColor: ['#3b82f6cc','#10b981cc','#f59e0bcc','#ef4444cc','#8b5cf6cc'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function drawRadar(all) {
  if (charts.radar) charts.radar.destroy();
  const ctx = document.getElementById('radar-chart');
  if (!ctx) return;
  const methods = Object.keys(all);
  const alts = all[methods[0]].ranking.map(r => r.alternative);
  const colors = ['#3b82f6','#10b981','#f59e0b'];
  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: alts,
      datasets: methods.map((m, i) => ({
        label: m,
        data: alts.map(alt => {
          const r = all[m].ranking.find(x => x.alternative === alt);
          return parseFloat(r.score.toFixed(4));
        }),
        borderColor: colors[i],
        backgroundColor: colors[i] + '22',
        pointBackgroundColor: colors[i]
      }))
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } } }
  });
}

// ── Sensitivity ─────────────────────────────────────────────
document.getElementById('btn-sensitivity').addEventListener('click', async () => {
  const cid    = document.getElementById('sens-criteria').value;
  const method = document.getElementById('sens-method').value;
  const out    = document.getElementById('sensitivity-result');
  out.innerHTML = '<div class="loading">Обчислення…</div>';
  try {
    const data = await api(`/sensitivity/${cid}?method=${method}`);
    out.innerHTML = `
      <p class="small" style="margin-top:0.75rem">Критерій: <strong>${data.criteriaName}</strong> · метод: <strong>${data.method}</strong></p>
      <canvas id="sens-chart" style="max-height:280px"></canvas>
    `;
    setTimeout(() => drawSensitivity(data), 50);
  } catch (e) {
    out.innerHTML = `<div class="error">${e.message}</div>`;
  }
});

function drawSensitivity(data) {
  if (charts.sens) charts.sens.destroy();
  const ctx = document.getElementById('sens-chart');
  if (!ctx) return;
  const alts = data.results[0].ranking.map(r => r.alternative);
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
  charts.sens = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.results.map(r => r.weight.toFixed(2)),
      datasets: alts.map((alt, i) => ({
        label: alt,
        data: data.results.map(r => {
          const item = r.ranking.find(x => x.alternative === alt);
          return item ? parseFloat(item.score.toFixed(4)) : null;
        }),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '22',
        tension: 0.3
      }))
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' }, title: { display: true, text: `Вплив зміни ваги "${data.criteriaName}" на оцінки` } },
      scales: { x: { title: { display: true, text: 'Вага критерію' } }, y: { title: { display: true, text: 'Оцінка' } } }
    }
  });
}

// ── Init ────────────────────────────────────────────────────
loadExperts();
