const API = '/api';
let projects = [];
let activeFilter = 'all';
let lightboxIndex = 0;

const grid = document.getElementById('grid');
const filtersEl = document.getElementById('filters');

async function loadProjects(){
  try{
    const res = await fetch(`${API}/projects`);
    projects = await res.json();
    document.getElementById('statCount').textContent = projects.length;
    renderGrid();
  }catch(err){
    grid.innerHTML = `<div class="empty-state">Couldn't reach the archive API. Is the server running?</div>`;
  }
}

function renderGrid(){
  const filtered = activeFilter === 'all' ? projects : projects.filter(p => p.media_type === activeFilter);
  if(filtered.length === 0){
    grid.innerHTML = `<div class="empty-state">No pieces yet — add one from the admin panel.</div>`;
    return;
  }
  grid.innerHTML = filtered.map((p, i) => `
    <div class="card" data-id="${p.id}">
      <span class="media-badge">${p.media_type}</span>
      ${p.media_type === 'video'
        ? `<video src="${p.media_path}" muted loop playsinline preload="metadata"></video>`
        : `<img src="${p.media_path}" alt="${escapeHtml(p.title)}" loading="lazy">`}
      <div class="card-info">
        <div class="tag">${escapeHtml((p.tags||'').split(',')[0] || p.media_type)}</div>
        <h3>${escapeHtml(p.title)}</h3>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.card').forEach(card => {
    const id = Number(card.dataset.id);
    card.addEventListener('mouseenter', () => {
      const v = card.querySelector('video');
      if(v) v.play().catch(()=>{});
    });
    card.addEventListener('mouseleave', () => {
      const v = card.querySelector('video');
      if(v){ v.pause(); v.currentTime = 0; }
    });
    card.addEventListener('click', () => openLightbox(filtered.findIndex(p => p.id === id), filtered));
  });
}

filtersEl.addEventListener('click', e => {
  if(!e.target.matches('.filter-btn')) return;
  filtersEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  activeFilter = e.target.dataset.filter;
  renderGrid();
});

// ---------------- Lightbox ----------------
const lightbox = document.getElementById('lightbox');
const lightboxMedia = document.getElementById('lightboxMedia');
let currentSet = [];

function openLightbox(index, set){
  currentSet = set;
  lightboxIndex = index;
  renderLightbox();
  lightbox.classList.add('open');
}

function renderLightbox(){
  const p = currentSet[lightboxIndex];
  lightboxMedia.innerHTML = p.media_type === 'video'
    ? `<video src="${p.media_path}" controls autoplay loop></video>`
    : `<img src="${p.media_path}" alt="${escapeHtml(p.title)}">`;
  document.getElementById('lbTag').textContent = (p.tags || p.media_type).split(',')[0];
  document.getElementById('lbTitle').textContent = p.title;
  document.getElementById('lbDesc').textContent = p.description || '';
}

document.getElementById('lightboxClose').addEventListener('click', () => lightbox.classList.remove('open'));
lightbox.addEventListener('click', e => { if(e.target === lightbox) lightbox.classList.remove('open'); });
document.getElementById('lbPrev').addEventListener('click', () => {
  lightboxIndex = (lightboxIndex - 1 + currentSet.length) % currentSet.length;
  renderLightbox();
});
document.getElementById('lbNext').addEventListener('click', () => {
  lightboxIndex = (lightboxIndex + 1) % currentSet.length;
  renderLightbox();
});
document.addEventListener('keydown', e => {
  if(!lightbox.classList.contains('open')) return;
  if(e.key === 'Escape') lightbox.classList.remove('open');
  if(e.key === 'ArrowRight') document.getElementById('lbNext').click();
  if(e.key === 'ArrowLeft') document.getElementById('lbPrev').click();
});

// ---------------- Contact form ----------------
document.getElementById('contactForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const msgEl = document.getElementById('formMsg');
  const payload = {
    name: form.name.value,
    email: form.email.value,
    message: form.message.value
  };
  try{
    const res = await fetch(`${API}/messages`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error((await res.json()).error || 'Failed to send');
    msgEl.textContent = 'Message sent — thank you.';
    msgEl.className = 'form-msg ok';
    form.reset();
  }catch(err){
    msgEl.textContent = err.message;
    msgEl.className = 'form-msg err';
  }
});

function escapeHtml(str=''){
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

loadProjects();
