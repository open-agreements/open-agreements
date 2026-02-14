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
