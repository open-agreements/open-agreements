// Reveal on scroll
const nodes = document.querySelectorAll('.reveal');

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    }
  },
  { threshold: 0.15 }
);

nodes.forEach((node) => io.observe(node));

// Copy-to-clipboard buttons
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const text = btn.getAttribute('data-copy');
    navigator.clipboard.writeText(text).then(() => {
      const label = btn.querySelector('.copy-label');
      if (label) {
        const origHTML = label.innerHTML;
        label.innerHTML = '<svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span class="copy-tooltip">Copied!</span>';
        setTimeout(() => { label.innerHTML = origHTML; }, 1500);
      }
    });
  });
});

// npm download stats in trust badge
async function fetchDownloadStats() {
  const res = await fetch('https://api.npmjs.org/downloads/point/last-month/open-agreements');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { downloads } = await res.json();
  const downloadLabel = Number.isFinite(downloads) ? `${downloads.toLocaleString()}/month` : 'unavailable';

  document.querySelectorAll('[data-npm-downloads]').forEach((el) => {
    el.textContent = downloadLabel;
  });
}
fetchDownloadStats().catch(() => {
  document.querySelectorAll('[data-npm-downloads]').forEach((el) => {
    el.textContent = 'unavailable';
  });
});

// Template-aware install section: react to ?template= param
(function () {
  // Preferred: /?template=<id>#install (standard query param)
  let templateId = new URLSearchParams(window.location.search).get('template');

  // Fallback: /#install?template=<id> (legacy hash-based)
  if (!templateId) {
    const hash = window.location.hash;
    if (hash.includes('?template=')) {
      const qs = hash.split('?')[1];
      if (qs) templateId = new URLSearchParams(qs).get('template');
    }
  }

  if (!templateId) return;

  // Look up display name from embedded map
  const mapEl = document.getElementById('template-map');
  let displayName = templateId;
  if (mapEl) {
    try {
      const map = JSON.parse(mapEl.textContent);
      if (map[templateId]) displayName = map[templateId];
    } catch (e) { /* use raw ID */ }
  }

  // Show contextual banner
  const banner = document.getElementById('install-context');
  const nameEl = document.getElementById('install-context-name');
  if (banner && nameEl) {
    nameEl.textContent = displayName;
    banner.hidden = false;
  }

  // Pre-fill CLI example with template ID (lives in #start section)
  const cliCode = document.querySelector('#start pre code');
  if (cliCode) {
    cliCode.textContent = `npx -y open-agreements@latest fill ${templateId}`;
  }

  // Scroll to installation instructions section
  const installSection = document.getElementById('start');
  if (installSection) {
    requestAnimationFrame(() => {
      installSection.scrollIntoView({ behavior: 'smooth' });
    });
  }
})();
