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

// Live MCP status pill
const statusPill = document.querySelector('[data-live-status-pill]');
const statusValue = document.querySelector('[data-live-status-value]');
let statusState = 'checking';
let statusLastCheckedAt = null;

function formatRelativeMinuteTime(date) {
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60_000));
  return `${elapsedMinutes} min ago`;
}

function renderStatusPill() {
  if (!statusPill || !statusValue) return;

  const stateText = {
    checking: 'checking…',
    good: 'operational',
    bad: 'degraded',
    unknown: 'unverified',
  }[statusState] ?? 'unverified';

  statusValue.classList.remove('is-checking', 'is-good', 'is-bad', 'is-unknown');
  statusValue.classList.add(`is-${statusState}`);

  if (statusLastCheckedAt) {
    statusValue.textContent = `${stateText} • ${formatRelativeMinuteTime(statusLastCheckedAt)}`;
    statusPill.title = `Last checked ${statusLastCheckedAt.toLocaleString()}`;
  } else {
    statusValue.textContent = stateText;
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
    if (state === 'degraded') return 'bad';
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
    if (res.status === 404) return 'unknown';
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
    if (apiStatusState === 'good' || apiStatusState === 'bad') {
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
