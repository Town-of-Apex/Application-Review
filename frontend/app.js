/* ============================================================
   Application Review — Vanilla JS frontend
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let profiles = [];
let editingProfileId = null;   // null = new profile
let selectedResumeFile = null;
let resumeMode = 'upload';     // 'upload' | 'text'

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfiles();
  checkOllamaStatus();
  initBatch();
  setupDragDrop();
});

// ── Tab routing ───────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
  document.getElementById(`tab-btn-${tab}`).classList.add('active');

  if (tab === 'profiles') renderProfilesList();
}

// ── Ollama Status ─────────────────────────────────────────────
async function checkOllamaStatus() {
  const el   = document.getElementById('ollama-status');
  const text = document.getElementById('ollama-status-text');
  try {
    const res  = await fetch('/api/ollama-status');
    const data = await res.json();
    if (data.connected) {
      el.className = 'ollama-status connected';
      text.textContent = 'Ollama Connected';
      el.querySelector('.status-dot').classList.remove('pulse');
    } else {
      el.className = 'ollama-status disconnected';
      text.textContent = 'Ollama Offline';
    }
  } catch {
    el.className = 'ollama-status disconnected';
    text.textContent = 'Ollama Offline';
  }
}

// ── Profile loading ───────────────────────────────────────────
async function loadProfiles() {
  try {
    const res = await fetch('/api/profiles');
    profiles  = await res.json();
    rebuildProfileSelect();
  } catch (e) {
    showToast('Could not load profiles from server.', 'error');
  }
}

function rebuildProfileSelect() {
  const sel = document.getElementById('eval-profile-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Select a position —</option>';
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

// ── Evaluate Tab (Batch) ──────────────────────────────────────
let batchApplicants = [];
let currentApplicantId = null;
let isBatchRunning = false;

function initBatch() {
  if (batchApplicants.length === 0) {
    addApplicantToBatch();
  }
}

function addApplicantToBatch() {
  const id = crypto.randomUUID();
  batchApplicants.push({
    id,
    name: '',
    application_text: '',
    resume_mode: 'upload', // 'upload' | 'text'
    resume_text: '',
    resume_file: null,
    status: 'pending', // 'pending', 'evaluating', 'done', 'error'
    result: null
  });
  selectApplicant(id);
}

function selectApplicant(id) {
  currentApplicantId = id;
  renderBatchQueue();
  renderDetailView();
}

function removeCurrentApplicant() {
  if (!currentApplicantId) return;
  removeApplicant(currentApplicantId);
}

function removeApplicant(id) {
  batchApplicants = batchApplicants.filter(a => a.id !== id);
  if (currentApplicantId === id) {
    currentApplicantId = batchApplicants.length > 0 ? batchApplicants[0].id : null;
  }
  renderBatchQueue();
  renderDetailView();
}

function updateCurrentApplicant(field, value) {
  const app = batchApplicants.find(a => a.id === currentApplicantId);
  if (!app) return;
  app[field] = value;
  
  if (field === 'name') {
    renderBatchQueue();
  }
  updateBatchRunBtn();
}

function renderBatchQueue() {
  const list = document.getElementById('batch-queue-list');
  list.innerHTML = '';
  
  batchApplicants.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = `batch-applicant-item ${app.id === currentApplicantId ? 'active' : ''}`;
    item.onclick = () => {
      if (!isBatchRunning || app.status !== 'evaluating') {
        selectApplicant(app.id);
      }
    };
    
    let statusIcon = '⏳';
    let statusText = 'Pending';
    if (app.status === 'evaluating') { statusIcon = '⚙️'; statusText = 'Evaluating...'; }
    if (app.status === 'done') { statusIcon = '✅'; statusText = 'Complete'; }
    if (app.status === 'error') { statusIcon = '❌'; statusText = 'Error'; }

    item.innerHTML = `
      <div class="batch-applicant-info">
        <div class="batch-applicant-name">${escHtml(app.name || `Applicant ${index + 1}`)}</div>
        <div class="batch-applicant-status">${statusIcon} ${statusText}</div>
      </div>
      <button class="batch-remove-btn" onclick="event.stopPropagation(); removeApplicant('${app.id}')" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;
    list.appendChild(item);
  });
  
  updateBatchRunBtn();
}

function renderDetailView() {
  const app = batchApplicants.find(a => a.id === currentApplicantId);
  
  toggle('detail-empty', !app);
  toggle('detail-form', false);
  toggle('results-loading', false);
  toggle('results-content', false);
  
  if (!app) return;
  
  if (app.status === 'evaluating') {
    toggle('results-loading', true);
  } else if (app.status === 'done') {
    renderResults(app.result);
  } else {
    // Form view
    toggle('detail-form', true);
    document.getElementById('eval-applicant-name').value = app.name || '';
    document.getElementById('eval-application-text').value = app.application_text || '';
    document.getElementById('eval-resume-text').value = app.resume_text || '';
    
    // Sync tabs
    document.getElementById('resume-tab-upload').classList.toggle('active', app.resume_mode === 'upload');
    document.getElementById('resume-tab-text').classList.toggle('active', app.resume_mode === 'text');
    toggle('resume-upload-panel', app.resume_mode === 'upload');
    toggle('resume-text-panel', app.resume_mode === 'text');
    
    const fnEl = document.getElementById('upload-filename');
    if (app.resume_file) {
      fnEl.textContent = `📎 ${app.resume_file.name} (${(app.resume_file.size / 1024).toFixed(0)} KB)`;
      fnEl.classList.remove('hidden');
      document.querySelector('.upload-label').style.display = 'none';
      document.querySelector('.upload-icon').textContent = '✅';
    } else {
      fnEl.classList.add('hidden');
      document.querySelector('.upload-label').style.display = '';
      document.querySelector('.upload-icon').textContent = '📂';
      document.getElementById('resume-file-input').value = '';
    }
  }
}

function updateBatchRunBtn() {
  const btn = document.getElementById('batch-run-btn');
  const exportBtn = document.getElementById('batch-export-btn');
  const profileId = document.getElementById('eval-profile-select').value;
  
  const hasPending = batchApplicants.some(a => a.status === 'pending' || a.status === 'error');
  const allNamesPresent = batchApplicants.every(a => a.name.trim() !== '');
  
  btn.disabled = !profileId || !hasPending || !allNamesPresent || isBatchRunning || batchApplicants.length === 0;

  if (exportBtn) {
    const hasEvaluated = batchApplicants.some(a => a.status === 'done');
    exportBtn.disabled = !hasEvaluated;
  }
}

function onProfileSelected() {
  const id = document.getElementById('eval-profile-select').value;
  const pill = document.getElementById('profile-info-pill');
  if (pill) pill.style.display = id ? 'inline-flex' : 'none';
  updateBatchRunBtn();
}

function switchResumeTab(mode) {
  const app = batchApplicants.find(a => a.id === currentApplicantId);
  if (!app) return;
  app.resume_mode = mode;
  renderDetailView();
}

function onResumeFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  const app = batchApplicants.find(a => a.id === currentApplicantId);
  if (app) {
    app.resume_file = file;
    renderDetailView();
  }
}

function setupDragDrop() {
  const zone = document.getElementById('upload-zone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()      => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      document.getElementById('resume-file-input').files = e.dataTransfer.files;
      onResumeFileSelected({ files: [file] });
    }
  });
}

async function startBatchEvaluation() {
  const profileId = document.getElementById('eval-profile-select').value;
  if (!profileId) return;

  const pendingApps = batchApplicants.filter(a => a.status === 'pending' || a.status === 'error');
  if (pendingApps.length === 0) return;

  isBatchRunning = true;
  document.getElementById('eval-profile-select').disabled = true;
  const btn = document.getElementById('batch-run-btn');
  btn.classList.add('btn-loading');
  updateBatchRunBtn();

  for (const app of pendingApps) {
    if (!app.application_text.trim() && !app.resume_text.trim() && !app.resume_file) {
      app.status = 'error';
      showToast(`Missing all information for ${app.name}`, 'error');
      continue;
    }

    app.status = 'evaluating';
    if (currentApplicantId === app.id) renderDetailView();
    renderBatchQueue();

    const form = new FormData();
    form.append('profile_id', profileId);
    form.append('applicant_name', app.name.trim());
    form.append('application_text', app.application_text.trim());
    form.append('resume_text', app.resume_mode === 'text' ? app.resume_text.trim() : '');

    if (app.resume_mode === 'upload' && app.resume_file) {
      form.append('resume_file', app.resume_file);
    }

    try {
      const res = await fetch('/api/evaluate', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Evaluation failed.');
      app.status = 'done';
      app.result = data;
    } catch (e) {
      app.status = 'error';
      showToast(`Error evaluating ${app.name}: ${e.message}`, 'error');
    }

    if (currentApplicantId === app.id) renderDetailView();
    renderBatchQueue();
  }

  isBatchRunning = false;
  document.getElementById('eval-profile-select').disabled = false;
  btn.classList.remove('btn-loading');
  updateBatchRunBtn();
  showToast('Batch evaluation complete!', 'success');
}

function reevaluateCurrentApplicant() {
  const app = batchApplicants.find(a => a.id === currentApplicantId);
  if (!app) return;
  app.status = 'pending';
  app.result = null;
  renderDetailView();
  renderBatchQueue();
}

function renderResults(data) {
  toggle('results-loading', false);
  toggle('results-content', true);

  // Names
  document.getElementById('result-applicant-name').textContent = data.applicant_name;
  document.getElementById('result-position-name').textContent  = `for ${data.profile_name}`;

  // Score gauge
  const score = data.score;
  animateScore(score);

  // Band label
  const bandEl = document.getElementById('score-band-label');
  if (score < 40) {
    bandEl.textContent = 'Poor Fit';
    bandEl.className   = 'score-band-label band-poor';
  } else if (score < 70) {
    bandEl.textContent = 'Moderate Fit';
    bandEl.className   = 'score-band-label band-moderate';
  } else if (score < 85) {
    bandEl.textContent = 'Good Fit';
    bandEl.className   = 'score-band-label band-good';
  } else {
    bandEl.textContent = 'Excellent Fit';
    bandEl.className   = 'score-band-label band-excellent';
  }

  // Summary
  document.getElementById('result-summary').textContent = data.summary;

  // Criteria breakdown
  const container = document.getElementById('criteria-breakdown');
  container.innerHTML = '';
  (data.criteria_breakdown || []).forEach(item => {
    const align = (item.alignment || 'moderate').toLowerCase();
    const alignClass = align === 'high' ? 'align-high' : align === 'low' ? 'align-low' : 'align-moderate';
    const alignLabel = align.charAt(0).toUpperCase() + align.slice(1);
    const weight     = item.weight || 5;

    const pips = Array.from({ length: 10 }, (_, i) =>
      `<div class="weight-pip ${i < weight ? 'filled' : ''}"></div>`
    ).join('');

    container.innerHTML += `
      <div class="criterion-row">
        <div>
          <div class="criterion-name">${escHtml(item.criterion)}</div>
          <div class="weight-pip-row">${pips}</div>
          <div class="criterion-assessment">${escHtml(item.assessment)}</div>
        </div>
        <div><span class="alignment-tag ${alignClass}">${alignLabel}</span></div>
      </div>`;
  });
}

function animateScore(target) {
  const circ = 2 * Math.PI * 56; // 351.86
  const fill = document.getElementById('gauge-fill');
  const numEl = document.getElementById('score-value');

  // Color by band
  let color;
  if (target < 40)      color = '#d94f3c';
  else if (target < 70) color = 'var(--warm-signal)';
  else if (target < 85) color = 'var(--cool-insight)';
  else                  color = 'var(--brand-accent)';

  fill.style.stroke = color;

  const offset = circ - (target / 100) * circ;
  fill.style.strokeDashoffset = offset;

  // Animate number
  let current = 0;
  const step  = Math.ceil(target / 40);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    numEl.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 25);
}

// ── Profile Info Modal ────────────────────────────────────────
function showProfileModal() {
  const id      = document.getElementById('eval-profile-select').value;
  const profile = profiles.find(p => p.id === id);
  if (!profile) return;

  document.getElementById('modal-profile-name').textContent = profile.name;
  document.getElementById('modal-profile-desc').textContent = profile.description;
  document.getElementById('modal-job-description').textContent = profile.job_description;

  const list = document.getElementById('modal-criteria-list');
  list.innerHTML = (profile.criteria || []).map(c => `
    <div style="padding:0.6rem 0.75rem; border-radius:10px; border:1px solid var(--line-gray); background:var(--soft-canvas)">
      <div style="font-weight:600; font-size:0.85rem">${escHtml(c.name)} <span style="color:var(--brand-accent); font-size:0.75rem; font-weight:700">[${c.weight}/10]</span></div>
      <div style="color:var(--muted-slate); font-size:0.78rem; margin-top:0.2rem">${escHtml(c.description)}</div>
    </div>
  `).join('');

  document.getElementById('profile-modal').classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.add('hidden');
}

// ── Profiles Tab ──────────────────────────────────────────────
function renderProfilesList() {
  const list = document.getElementById('profiles-list');
  list.innerHTML = '';
  profiles.forEach(p => {
    const item = document.createElement('div');
    item.className = `profile-list-item${editingProfileId === p.id ? ' active' : ''}`;
    item.innerHTML = `
      <div class="profile-list-name">${escHtml(p.name)}</div>
      <div class="profile-list-desc">${escHtml(p.description || '—')}</div>
      <div class="profile-criteria-count">${(p.criteria || []).length} criteria · ${p.ollama_model || 'gemma3:1b'}</div>`;
    item.onclick = () => openProfileEditor(p.id);
    list.appendChild(item);
  });
}

function openProfileEditor(profileId) {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;

  editingProfileId = profileId;
  renderProfilesList();
  showEditorForm(profile);
  document.getElementById('delete-profile-btn').style.display = '';
  document.getElementById('editor-form-title').textContent = 'Edit Profile';
}

function newProfile() {
  editingProfileId = null;
  renderProfilesList();
  showEditorForm({
    name: '', description: '', job_description: '',
    ollama_model: 'gemma3:1b', criteria: []
  });
  document.getElementById('delete-profile-btn').style.display = 'none';
  document.getElementById('editor-form-title').textContent = 'New Profile';
}

function showEditorForm(profile) {
  toggle('editor-empty', false);
  toggle('editor-form',  true);

  document.getElementById('editor-name').value            = profile.name || '';
  document.getElementById('editor-description').value     = profile.description || '';
  document.getElementById('editor-job-description').value = profile.job_description || '';
  document.getElementById('editor-model').value           = profile.ollama_model || 'gemma3:1b';

  renderCriteriaBuilder(profile.criteria || []);
  fetchAvailableModels();
}

function cancelEdit() {
  editingProfileId = null;
  toggle('editor-empty', true);
  toggle('editor-form',  false);
  renderProfilesList();
}

// Criteria builder
let tempCriteria = [];

function renderCriteriaBuilder(criteria) {
  tempCriteria = criteria.map(c => ({ ...c }));
  rebuildCriteriaUI();
}

function rebuildCriteriaUI() {
  const builder = document.getElementById('criteria-builder');
  builder.innerHTML = '';
  tempCriteria.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'criterion-card';
    card.innerHTML = `
      <div class="criterion-header">
        <input type="text" placeholder="Criterion name…" value="${escAttr(c.name)}"
          oninput="tempCriteria[${i}].name = this.value" />
        <button class="remove-criterion-btn" onclick="removeCriterion(${i})" title="Remove">✕</button>
      </div>
      <div class="criterion-desc">
        <input type="text" placeholder="Description (what to look for)…" value="${escAttr(c.description)}"
          oninput="tempCriteria[${i}].description = this.value" />
      </div>
      <div class="weight-row">
        <span class="weight-label">Weight</span>
        <input type="range" class="weight-slider" min="1" max="10" value="${c.weight || 5}"
          oninput="tempCriteria[${i}].weight = parseInt(this.value); this.nextElementSibling.textContent = this.value" />
        <span class="weight-value">${c.weight || 5}</span>
      </div>`;
    builder.appendChild(card);
  });
}

function addCriterion() {
  tempCriteria.push({ id: crypto.randomUUID(), name: '', description: '', weight: 5 });
  rebuildCriteriaUI();
  // Scroll to new card
  const builder = document.getElementById('criteria-builder');
  builder.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  builder.lastElementChild?.querySelector('input')?.focus();
}

function removeCriterion(index) {
  tempCriteria.splice(index, 1);
  rebuildCriteriaUI();
}

async function fetchAvailableModels() {
  const hint = document.getElementById('available-models-hint');
  try {
    const res  = await fetch('/api/ollama-status');
    const data = await res.json();
    if (data.connected && data.models.length) {
      hint.textContent = `Available: ${data.models.join(', ')}`;
    } else if (!data.connected) {
      hint.textContent = 'Ollama is offline — model list unavailable.';
    } else {
      hint.textContent = 'No models found. Run: ollama pull gemma3:1b';
    }
  } catch {
    hint.textContent = '';
  }
}

async function saveProfile() {
  const name    = document.getElementById('editor-name').value.trim();
  const desc    = document.getElementById('editor-description').value.trim();
  const jobDesc = document.getElementById('editor-job-description').value.trim();
  const model   = document.getElementById('editor-model').value.trim() || 'gemma3:1b';

  if (!name)    { showToast('Position name is required.', 'error'); return; }
  if (!jobDesc) { showToast('Job description is required.', 'error'); return; }
  if (tempCriteria.filter(c => c.name).length === 0) {
    showToast('Add at least one criterion.', 'error'); return;
  }

  const payload = {
    name,
    description: desc,
    job_description: jobDesc,
    ollama_model: model,
    criteria: tempCriteria.filter(c => c.name.trim()).map(c => ({
      id: c.id || crypto.randomUUID(),
      name: c.name.trim(),
      description: c.description.trim(),
      weight: c.weight,
    })),
  };

  try {
    let res;
    if (editingProfileId) {
      res = await fetch(`/api/profiles/${editingProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Save failed.');
    }

    const saved = await res.json();
    showToast(`Profile "${saved.name}" saved.`, 'success');
    await loadProfiles();
    editingProfileId = saved.id;
    renderProfilesList();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function confirmDeleteProfile() {
  if (!editingProfileId) return;
  const profile = profiles.find(p => p.id === editingProfileId);
  document.getElementById('delete-modal-text').textContent =
    `This will permanently remove "${profile?.name || 'this profile'}". This cannot be undone.`;
  document.getElementById('delete-modal').classList.remove('hidden');
}

async function executeDeleteProfile() {
  document.getElementById('delete-modal').classList.add('hidden');
  if (!editingProfileId) return;
  try {
    const res = await fetch(`/api/profiles/${editingProfileId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed.');
    showToast('Profile deleted.', 'info');
    editingProfileId = null;
    await loadProfiles();
    toggle('editor-empty', true);
    toggle('editor-form',  false);
    renderProfilesList();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ── Utilities ─────────────────────────────────────────────────
function toggle(id, show) {
  const el = document.getElementById(id);
  if (show) el.classList.remove('hidden');
  else      el.classList.add('hidden');
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function exportEvaluations() {
  const doneApps = batchApplicants.filter(a => a.status === 'done');
  if (doneApps.length === 0) return;

  const profileSel = document.getElementById('eval-profile-select');
  const profileName = profileSel.options[profileSel.selectedIndex].text;

  let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Evaluation Report - ${escHtml(profileName)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f7f9f8; color: #1f2a2e; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 3rem; }
        .header h1 { margin: 0; font-size: 2rem; color: #1f2a2e; }
        .header p { color: #5c6b73; margin-top: 0.5rem; }
        .card { background: #fff; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8e5; }
        .card-header { display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid #e2e8e5; padding-bottom: 1rem; margin-bottom: 1rem; }
        .applicant-name { font-size: 1.3rem; font-weight: 600; margin: 0; }
        .score-wrap { text-align: right; }
        .score-val { font-size: 1.8rem; font-weight: 700; line-height: 1; }
        .score-label { font-size: 0.8rem; color: #5c6b73; font-weight: 600; text-transform: uppercase; }
        .ai-rationale { font-size: 0.95rem; line-height: 1.6; color: #1f2a2e; }
        .section-label { font-size: 0.8rem; color: #5c6b73; font-weight: 600; text-transform: uppercase; margin-bottom: 0.5rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Batch Evaluation Report</h1>
          <p>Position: <strong>${escHtml(profileName)}</strong></p>
        </div>
  `;

  doneApps.forEach(app => {
    let color = '#2f6f5e';
    if (app.result.score < 40) color = '#d94f3c';
    else if (app.result.score < 70) color = '#f2a65a';
    else if (app.result.score < 85) color = '#5da9e9';

    htmlContent += `
        <div class="card">
          <div class="card-header">
            <h2 class="applicant-name">${escHtml(app.name)}</h2>
            <div class="score-wrap">
              <div class="score-val" style="color: ${color}">${app.result.score}</div>
              <div class="score-label">/ 100</div>
            </div>
          </div>
          <div>
            <div class="section-label">AI Rationale</div>
            <div class="ai-rationale">${escHtml(app.result.summary)}</div>
          </div>
        </div>
    `;
  });

  htmlContent += `
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Batch_Report_${profileName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
