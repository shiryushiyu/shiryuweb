const API = '/api';
const OWNER = 'allchemi';

let projects = [];
let activeFilter = 'all';
let lightboxIndex = 0;
let currentSet = [];

const grid = document.getElementById('grid');
const filtersEl = document.getElementById('filters');
const lightbox = document.getElementById('lightbox');
const lightboxMedia = document.getElementById('lightboxMedia');

function mediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('/api/project-media')) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `/api/project-media?owner=${encodeURIComponent(OWNER)}&pathname=${encodeURIComponent(path)}`;
}

function youtubeThumbnail(id) {
  return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

async function loadProjects() {
  try {
    const res = await fetch(`${API}/projects?owner=${OWNER}`);

    if (!res.ok) {
      throw new Error('Failed to load projects');
    }

    projects = await res.json();

    if (!Array.isArray(projects)) {
      throw new Error('Invalid project data');
    }

    document.getElementById('statCount').textContent = projects.length;
    renderGrid();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Couldn't reach the archive API. Is the server running?</div>`;
  }
}

function getFilteredProjects() {
  if (activeFilter === 'all') {
    return projects;
  }

  return projects.filter(p => p.media_type === activeFilter);
}

function renderGrid() {
  const filtered = getFilteredProjects();

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">No pieces yet — add one from the admin panel.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const mediaPath = mediaUrl(p.media_path);

    let media;

    if (p.media_type === 'video') {
      media = `<video src="${escapeHtml(mediaPath)}" muted loop playsinline preload="metadata"></video>`;
    } else if (p.media_type === 'youtube') {
      media = `<img src="${youtubeThumbnail(p.media_path)}" alt="${escapeHtml(p.title)}" loading="lazy">`;
    } else {
      media = `<img src="${escapeHtml(mediaPath)}" alt="${escapeHtml(p.title)}" loading="lazy">`;
    }

    const label = {
      image: 'Image',
      video: 'Video',
      youtube: 'YouTube'
    }[p.media_type] || p.media_type;

    return `
      <div class="card" data-id="${p.id}">
        <span class="media-badge">${label}</span>
        ${media}
        <div class="card-info">
          <div class="tag">${escapeHtml((p.tags || '').split(',')[0] || label)}</div>
          <h3>${escapeHtml(p.title)}</h3>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.card').forEach(card => {
    const id = Number(card.dataset.id);

    card.addEventListener('mouseenter', () => {
      const video = card.querySelector('video');

      if (video) {
        video.play().catch(() => {});
      }
    });

    card.addEventListener('mouseleave', () => {
      const video = card.querySelector('video');

      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });

    card.addEventListener('click', () => {
      const index = filtered.findIndex(p => p.id === id);
      openLightbox(index, filtered);
    });
  });
}

filtersEl.addEventListener('click', e => {
  if (!e.target.matches('.filter-btn')) return;

  filtersEl.querySelectorAll('.filter-btn').forEach(button => {
    button.classList.remove('active');
  });

  e.target.classList.add('active');
  activeFilter = e.target.dataset.filter;

  renderGrid();
});

function openLightbox(index, set) {
  currentSet = set;
  lightboxIndex = index;

  renderLightbox();
  lightbox.classList.add('open');
}

function renderLightbox() {
  const project = currentSet[lightboxIndex];

  if (!project) return;

  const mediaPath = mediaUrl(project.media_path);

  if (project.media_type === 'video') {
    lightboxMedia.innerHTML = `
      <video src="${escapeHtml(mediaPath)}" controls autoplay loop></video>
    `;
  } else if (project.media_type === 'youtube') {
    lightboxMedia.innerHTML = `
      <div style="position:relative;width:100%;aspect-ratio:16/9;">
        <iframe
          style="position:absolute;inset:0;width:100%;height:100%;"
          src="https://www.youtube.com/embed/${encodeURIComponent(project.media_path)}?autoplay=1"
          title="${escapeHtml(project.title)}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
    `;
  } else {
    lightboxMedia.innerHTML = `
      <img src="${escapeHtml(mediaPath)}" alt="${escapeHtml(project.title)}">
    `;
  }

  const label = {
    image: 'Image',
    video: 'Video',
    youtube: 'YouTube'
  }[project.media_type] || project.media_type;

  document.getElementById('lbTag').textContent =
    (project.tags || label).split(',')[0];

  document.getElementById('lbTitle').textContent = project.title;
  document.getElementById('lbDesc').textContent = project.description || '';
}

document.getElementById('lightboxClose').addEventListener('click', () => {
  lightbox.classList.remove('open');
  lightboxMedia.innerHTML = '';
});

lightbox.addEventListener('click', e => {
  if (e.target === lightbox) {
    lightbox.classList.remove('open');
    lightboxMedia.innerHTML = '';
  }
});

document.getElementById('lbPrev').addEventListener('click', () => {
  if (!currentSet.length) return;

  lightboxIndex =
    (lightboxIndex - 1 + currentSet.length) % currentSet.length;

  renderLightbox();
});

document.getElementById('lbNext').addEventListener('click', () => {
  if (!currentSet.length) return;

  lightboxIndex =
    (lightboxIndex + 1) % currentSet.length;

  renderLightbox();
});

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;

  if (e.key === 'Escape') {
    lightbox.classList.remove('open');
    lightboxMedia.innerHTML = '';
  }

  if (e.key === 'ArrowRight') {
    document.getElementById('lbNext').click();
  }

  if (e.key === 'ArrowLeft') {
    document.getElementById('lbPrev').click();
  }
});

document.getElementById('contactForm').addEventListener('submit', async e => {
  e.preventDefault();

  const form = e.target;
  const msgEl = document.getElementById('formMsg');

  const payload = {
    name: form.name.value,
    message: form.message.value,
    owner: OWNER
  };

  try {
    const res = await fetch(`${API}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(
        (await res.json()).error || 'Failed to send'
      );
    }

    msgEl.textContent = 'Message sent — thank you.';
    msgEl.className = 'form-msg ok';

    form.reset();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'form-msg err';
  }
});

function escapeHtml(str = '') {
  return String(str).replace(
    /[&<>"']/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m])
  );
}

loadProjects();