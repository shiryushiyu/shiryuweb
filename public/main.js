const API = '/api';
let projects = [];
let currentFilter = 'all';
let lightboxIndex = -1;

async function loadProjects() {
  try {
    const res = await fetch(`${API}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    projects = await res.json();
    renderGrid();
    updateStats();
  } catch (err) {
    console.error('Error loading projects:', err);
    document.getElementById('grid').innerHTML = '<div class="empty-state">Failed to load projects</div>';
  }
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const filtered = projects.filter(p => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'image') return p.media_type === 'image';
    if (currentFilter === 'video') return p.media_type === 'video' || p.media_type === 'youtube';
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No pieces found</div>';
    return;
  }

  grid.innerHTML = filtered.map((p) => {
    const projectIndex = projects.indexOf(p);
    const tags = p.tags ? p.tags.split(',').map(t => t.trim()).slice(0, 3).join(', ') : '';
    
    return `
      <div class="card" onclick="openLightbox(${projectIndex})" role="button" tabindex="0" aria-label="View ${p.title}">
        ${renderMediaThumbnail(p)}
        <span class="media-badge">${p.media_type === 'youtube' ? 'video' : p.media_type}</span>
        <div class="card-info">
          <div class="tag">${tags || p.media_type}</div>
          <h3>${escapeHtml(p.title)}</h3>
        </div>
      </div>
    `;
  }).join('');
}

function renderMediaThumbnail(p) {
  if (p.media_type === 'youtube') {
    return `
      <div class="youtube-thumb">
        <img src="https://img.youtube.com/vi/${p.media_path}/hqdefault.jpg" alt="${escapeHtml(p.title)}" loading="lazy">
        <div class="play-button">▶</div>
      </div>
    `;
  } else if (p.media_type === 'video') {
    return `<video src="${p.media_path}" muted loop playsinline preload="metadata"></video>`;
  } else {
    return `<img src="${p.media_path}" alt="${escapeHtml(p.title)}" loading="lazy">`;
  }
}

function updateStats() {
  const countEl = document.getElementById('statCount');
  if (countEl) countEl.textContent = projects.length;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderGrid();
  });
});

function openLightbox(index) {
  lightboxIndex = index;
  const project = projects[index];
  const lightbox = document.getElementById('lightbox');
  const mediaContainer = document.getElementById('lightboxMedia');
  const titleEl = document.getElementById('lbTitle');
  const descEl = document.getElementById('lbDesc');
  const tagEl = document.getElementById('lbTag');
  
  mediaContainer.innerHTML = renderLightboxMedia(project);
  titleEl.textContent = project.title;
  descEl.textContent = project.description || '';
  tagEl.textContent = project.tags || project.media_type.toUpperCase();
  
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderLightboxMedia(p) {
  if (p.media_type === 'youtube') {
    return `
      <iframe 
        width="100%" 
        height="500" 
        src="https://www.youtube.com/embed/${p.media_path}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    `;
  } else if (p.media_type === 'video') {
    return `<video src="${p.media_path}" controls autoplay loop></video>`;
  } else {
    return `<img src="${p.media_path}" alt="${escapeHtml(p.title)}">`;
  }
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightboxMedia').innerHTML = '';
  document.body.style.overflow = '';
}

function navigateLightbox(direction) {
  lightboxIndex += direction;
  if (lightboxIndex < 0) lightboxIndex = projects.length - 1;
  if (lightboxIndex >= projects.length) lightboxIndex = 0;
  openLightbox(lightboxIndex);
}

document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => navigateLightbox(-1));
document.getElementById('lbNext').addEventListener('click', () => navigateLightbox(1));

document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeLightbox();
  }
});

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
  if (e.key === 'ArrowRight') navigateLightbox(1);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const card = document.activeElement;
    if (card && card.classList.contains('card')) {
      e.preventDefault();
      card.click();
    }
  }
});

document.getElementById('contactForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('formMsg');
  const formData = new FormData(e.target);
  
  try {
    const res = await fetch(`${API}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        message: formData.get('message')
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      msgEl.textContent = 'Message sent successfully!';
      msgEl.className = 'form-msg ok';
      e.target.reset();
    } else {
      throw new Error(data.error || 'Failed to send message');
    }
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'form-msg err';
  }
});

loadProjects();