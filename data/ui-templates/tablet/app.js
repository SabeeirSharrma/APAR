// Tablet Interviewer Template — app.js
const API_BASE = window.APAR_API_BASE || '/api/v1';
let authToken = localStorage.getItem('apar_token');
let userId = localStorage.getItem('apar_user_id');

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

// Tab navigation
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    tab.classList.add('active');
    if (view === 'candidates') loadCandidates();
    if (view === 'dashboard') loadDashboard();
  });
});

async function loadDashboard() {
  const data = await api('GET', '/applicants?assignedTo=me&pageSize=100');
  if (!data.success) return;
  const items = data.data.items || [];
  document.getElementById('stat-pending').textContent = items.filter(a => a.status === 'delivered').length;
  document.getElementById('stat-approved').textContent = items.filter(a => a.status === 'approved').length;
  document.getElementById('stat-rejected').textContent = items.filter(a => a.status === 'rejected').length;
}

async function loadCandidates() {
  const data = await api('GET', '/applicants?assignedTo=me&pageSize=50');
  if (!data.success) return;
  document.getElementById('candidates-list').innerHTML = data.data.items.map(a => `
    <div class="applicant-card">
      <h3>${a.name}</h3>
      <p>${a.email} • ${a.position_name || '-'}</p>
      <span class="badge badge-${statusColor(a.status)}">${a.status}</span>
    </div>
  `).join('');
}

function statusColor(s) {
  return { approved: 'green', rejected: 'red', delivered: 'blue' }[s] || 'yellow';
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('apar_token');
  localStorage.removeItem('apar_user_id');
  window.location.href = '/interviewer.html';
});

if (!authToken) window.location.href = '/interviewer.html';
else { document.getElementById('user-name').textContent = userId || 'Interviewer'; loadDashboard(); }