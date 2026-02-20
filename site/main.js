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

// Mobile top navigation toggle
(function () {
  const topbar = document.querySelector('.topbar');
  const nav = document.getElementById('site-nav');
  const toggle = document.querySelector('.topnav-toggle');
  if (!topbar || !nav || !toggle) return;

  const mediaQuery = window.matchMedia('(max-width: 640px)');

  function closeNav() {
    topbar.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function setReadyState() {
    if (mediaQuery.matches) {
      toggle.hidden = false;
      closeNav();
    } else {
      toggle.hidden = true;
      closeNav();
    }
  }

  toggle.addEventListener('click', () => {
    const isOpen = topbar.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (mediaQuery.matches) closeNav();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav();
  });

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', setReadyState);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(setReadyState);
  }
  setReadyState();
})();

// MCP server status badge
const statusPill = document.querySelector('[data-live-status-pill]');
const statusImage = document.querySelector('[data-live-status-img]');
let statusState = 'checking';
let statusLastCheckedAt = null;

function formatRelativeMinuteTime(date) {
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60_000));
  return `${elapsedMinutes} min ago`;
}

function renderStatusPill() {
  if (!statusPill || !statusImage) return;

  const stateText = {
    checking: 'checking...',
    good: 'operational',
    bad: 'degraded',
    maintenance: 'maintenance',
    unknown: 'unverified',
  }[statusState] ?? 'checking...';

  const stateColor = {
    checking: '9f9f9f',
    good: '4c1',
    bad: 'e05d44',
    maintenance: 'dfb317',
    unknown: '9f9f9f',
  }[statusState] ?? '9f9f9f';

  const message = statusLastCheckedAt
    ? `${stateText} • ${formatRelativeMinuteTime(statusLastCheckedAt)}`
    : stateText;
  const label = 'MCP server status';
  const badgeUrl = `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${stateColor}.svg`;
  statusImage.src = badgeUrl;
  statusImage.alt = `${label}: ${message}`;

  if (statusLastCheckedAt) {
    statusPill.title = `Last checked ${statusLastCheckedAt.toLocaleString()}`;
  } else {
    statusPill.title = 'Checking service status';
  }
}

function setStatusState(nextState, checkedAt = new Date()) {
  statusState = nextState;
  statusLastCheckedAt = checkedAt;
  renderStatusPill();
}

async function fetchStatusFromApiStatus(baseOrigin = '') {
  try {
    const res = await fetch(`${baseOrigin}/api/status`, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    const state = typeof data?.status === 'string' ? data.status : '';

    if (state === 'operational') return 'good';
    if (
      state === 'degraded'
      || state === 'partial_outage'
      || state === 'major_outage'
      || state === 'outage'
      || state === 'incident'
    ) {
      return 'bad';
    }
    if (state === 'maintenance') return 'maintenance';
    return 'unknown';
  } catch {
    return null;
  }
}

async function fetchStatusFromMcp(baseOrigin = '') {
  try {
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      request.signal = AbortSignal.timeout(5000);
    }

    const res = await fetch(`${baseOrigin}/api/mcp`, request);
    if (res.ok) return 'good';
    if (res.status === 404 || res.status === 405 || res.status === 501) return 'unknown';
    return 'bad';
  } catch {
    return null;
  }
}

function getStatusOrigins() {
  const origins = [''];
  const canonical = 'https://openagreements.ai';

  if (typeof window !== 'undefined' && window.location.origin !== canonical) {
    origins.push(canonical);
  }

  return origins;
}

async function checkMcpStatus() {
  if (!statusPill) return;

  if (!statusLastCheckedAt) {
    statusState = 'checking';
    renderStatusPill();
  }

  const checkedAt = new Date();
  const origins = getStatusOrigins();
  let fallbackUnknown = false;

  for (const origin of origins) {
    const apiStatusState = await fetchStatusFromApiStatus(origin);
    if (apiStatusState === 'good' || apiStatusState === 'bad' || apiStatusState === 'maintenance') {
      setStatusState(apiStatusState, checkedAt);
      return;
    }
    if (apiStatusState === 'unknown') {
      fallbackUnknown = true;
    }

    const mcpState = await fetchStatusFromMcp(origin);
    if (mcpState === 'good' || mcpState === 'bad') {
      setStatusState(mcpState, checkedAt);
      return;
    }
    if (mcpState === 'unknown') {
      fallbackUnknown = true;
    }
  }

  setStatusState(fallbackUnknown ? 'unknown' : 'checking', checkedAt);
}

if (statusPill) {
  checkMcpStatus();
  setInterval(checkMcpStatus, 60_000);
  setInterval(() => {
    if (statusLastCheckedAt) renderStatusPill();
  }, 60_000);
}

// ─── Docs: ToC generation + active heading tracking ───
(function () {
  const content = document.getElementById('docs-content');
  const tocNav = document.getElementById('toc-nav');
  const tocContainer = document.querySelector('.docs-toc');
  if (!content || !tocNav) return;

  const headings = content.querySelectorAll('h2, h3');
  if (headings.length < 3) {
    if (tocContainer) tocContainer.style.display = 'none';
    return;
  }

  // Build ToC list
  const ul = document.createElement('ul');
  ul.className = 'toc-list';

  headings.forEach((heading) => {
    // Skip headings inside links (e.g. card titles on docs index)
    if (heading.closest('a')) return;

    // Grab heading text before we append anything
    const headingText = heading.textContent.trim();

    // Assign id slug if missing
    if (!heading.id) {
      heading.id = headingText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
    }

    // Add permalink anchor (no visible text — CSS ::after adds # on hover)
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = '#' + heading.id;
    anchor.setAttribute('aria-label', 'Link to this section');
    heading.appendChild(anchor);

    // Create ToC entry
    const li = document.createElement('li');
    li.className = heading.tagName === 'H3' ? 'toc-item toc-item-nested' : 'toc-item';
    const link = document.createElement('a');
    link.className = 'toc-link';
    link.href = '#' + heading.id;
    link.textContent = headingText;
    li.appendChild(link);
    ul.appendChild(li);
  });

  tocNav.appendChild(ul);

  // Active heading tracking via IntersectionObserver
  const tocLinks = tocNav.querySelectorAll('.toc-link');
  const headingMap = new Map();
  tocLinks.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    headingMap.set(id, link);
  });

  let activeId = null;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (activeId) {
            const prev = headingMap.get(activeId);
            if (prev) prev.classList.remove('is-active');
          }
          activeId = entry.target.id;
          const curr = headingMap.get(activeId);
          if (curr) curr.classList.add('is-active');
        }
      }
    },
    { rootMargin: '0px 0px -70% 0px', threshold: 0 }
  );

  headings.forEach((h) => observer.observe(h));
})();

// ─── Docs: Copy as Markdown ───
(function () {
  const btn = document.getElementById('copy-md');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const src = document.getElementById('page-markdown');
    if (!src) return;
    navigator.clipboard.writeText(src.textContent).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  });
})();

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
