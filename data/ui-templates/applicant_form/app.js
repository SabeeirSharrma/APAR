// Applicant Form Template — app.js
const API_BASE = window.APAR_API_BASE || '/api/v1';

// Load positions on page load
async function loadPositions() {
  try {
    const res = await fetch(`${API_BASE}/positions/public`);
    const data = await res.json();
    if (data.success) {
      const select = document.getElementById('position');
      data.data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Failed to load positions:', e);
  }
}

// Drag and drop
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('resume');
const filenameDisplay = document.getElementById('upload-filename');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    filenameDisplay.textContent = e.dataTransfer.files[0].name;
  }
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) filenameDisplay.textContent = fileInput.files[0].name;
});

// Form submission
document.getElementById('apply-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const formData = new FormData();
  formData.append('name', document.getElementById('name').value);
  formData.append('email', document.getElementById('email').value);
  formData.append('positionId', document.getElementById('position').value);
  formData.append('resume', fileInput.files[0]);
  const info = document.getElementById('info').value;
  if (info) formData.append('supplementaryInfo', info);

  try {
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      document.getElementById('apply-form').style.display = 'none';
      document.getElementById('success-message').style.display = 'block';
      document.getElementById('app-id-display').textContent = `Application ID: ${data.data.applicationId}`;
    } else {
      alert(data.error || 'Submission failed. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Submit Application';
    }
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Submit Application';
  }
});

loadPositions();