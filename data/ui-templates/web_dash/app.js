// Web Dashboard Template — app.js
const API_BASE = window.APAR_API_BASE || '/api/v1';
let authToken = localStorage.getItem('apar_token');

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

document.querySelectorAll('.sidebar nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    link.classList.add('active');
    const loaders = { dashboard: loadDashboard, positions: loadPositions, interviewers: loadInterviewers, applicants: loadApplicants, rounds: loadRounds, tags: loadTags, settings: loadSettings };
    if (loaders[view]) loaders[view]();
  });
});

async function loadDashboard() {
  const data = await api('GET', '/applicants?pageSize=100');
  if (!data.success) return;
  const items = data.data.items || [];
  document.getElementById('stat-total').textContent = items.length;
  document.getElementById('stat-pending').textContent = items.filter(a => a.status === 'delivered').length;
  document.getElementById('stat-approved').textContent = items.filter(a => a.status === 'approved').length;
  document.getElementById('stat-rejected').textContent = items.filter(a => a.status === 'rejected').length;
}

async function loadPositions() {
  const data = await api('GET', '/positions');
  if (!data.success) return;
  document.getElementById('positions-list').innerHTML = `<table><thead><tr><th>Name</th><th>Description</th></tr></thead><tbody>${data.data.map(p => `<tr><td>${p.name}</td><td>${p.description || '-'}</td></tr>`).join('')}</tbody></table>`;
}

async function loadInterviewers() {
  const data = await api('GET', '/interviewers');
  if (!data.success) return;
  document.getElementById('interviewers-list').innerHTML = `<table><thead><tr><th>Name</th><th>Email</th></tr></thead><tbody>${data.data.map(i => `<tr><td>${i.name}</td><td>${i.email}</td></tr>`).join('')}</tbody></table>`;
}

async function loadApplicants() {
  const data = await api('GET', '/applicants?pageSize=50');
  if (!data.success) return;
  document.getElementById('applicants-list').innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead><tbody>${data.data.items.map(a => `<tr><td>${a.name}</td><td>${a.email}</td><td><span class="badge badge-${statusColor(a.status)}">${a.status}</span></td></tr>`).join('')}</tbody></table>`;
}

async function loadRounds() { document.getElementById('rounds-list').innerHTML = '<p style="color:#64748b;">Configure rounds in Settings.</p>'; }
async function loadTags() { document.getElementById('tags-list').innerHTML = '<p style="color:#64748b;">Manage tags in Settings.</p>'; }
async function loadSettings() { document.getElementById('settings-content').innerHTML = '<p style="color:#64748b;">Settings panel — customize your deployment.</p>'; }

function statusColor(s) {
  return { approved: 'green', rejected: 'red', delivered: 'blue' }[s] || 'blue';
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('apar_token');
  window.location.href = '/admin.html';
});

if (!authToken) window.location.href = '/admin.html';
else loadDashboard();