// Desktop Interviewer Template — app.js
// This is a base template. Customize the API_BASE and endpoints for your deployment.

const API_BASE = window.APAR_API_BASE || '/api/v1';
let authToken = localStorage.getItem('apar_token');
let userId = localStorage.getItem('apar_user_id');

// --- API Helper ---
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

// --- Navigation ---
document.querySelectorAll('.sidebar nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    link.classList.add('active');
    if (view === 'candidates') loadCandidates();
    if (view === 'dashboard') loadDashboard();
  });
});

// --- Dashboard ---
async function loadDashboard() {
  const data = await api('GET', '/applicants?assignedTo=me&pageSize=100');
  if (!data.success) return;
  const items = data.data.items || [];
  document.getElementById('stat-pending').textContent = items.filter(a => a.status === 'delivered').length;
  document.getElementById('stat-approved').textContent = items.filter(a => a.status === 'approved').length;
  document.getElementById('stat-rejected').textContent = items.filter(a => a.status === 'rejected').length;
}

// --- Candidates ---
async function loadCandidates() {
  const data = await api('GET', '/applicants?assignedTo=me&pageSize=50');
  if (!data.success) return;
  const list = document.getElementById('candidates-list');
  list.innerHTML = data.data.items.map(a => `
    <div class="applicant-card" onclick="viewCandidate('${a.id}')">
      <h3>${a.name}</h3>
      <p>${a.email} • ${a.position_name || 'Unknown position'}</p>
      <span class="badge badge-${statusColor(a.status)}">${a.status}</span>
    </div>
  `).join('');
}

function statusColor(status) {
  const map = { approved: 'green', rejected: 'red', delivered: 'blue', queued: 'yellow', processing: 'yellow' };
  return map[status] || 'yellow';
}

async function viewCandidate(id) {
  // Override this to implement your custom candidate detail view
  console.log('View candidate:', id);
}

// --- Logout ---
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('apar_token');
  localStorage.removeItem('apar_user_id');
  window.location.href = '/interviewer.html';
});

// --- Init ---
if (!authToken) {
  window.location.href = '/interviewer.html';
} else {
  document.getElementById('user-name').textContent = userId || 'Interviewer';
  loadDashboard();
}