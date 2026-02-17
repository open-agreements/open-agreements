// Category filtering for /templates page
(function () {
  const tabs = document.querySelectorAll('.filter-tab');
  const select = document.querySelector('.filter-select');
  const cards = document.querySelectorAll('.template-card');
  const emptyState = document.getElementById('empty-state');

  function filterBy(category) {
    let visibleCount = 0;
    cards.forEach((card) => {
      const show = category === 'all' || card.dataset.category === category;
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    // Toggle empty state
    if (emptyState) {
      emptyState.classList.toggle('visible', visibleCount === 0);
    }

    // Update active tab
    tabs.forEach((tab) => {
      const isActive = tab.dataset.category === category;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update select
    if (select) {
      select.value = category;
    }

    // Update URL without adding to history
    const url = new URL(window.location);
    if (category === 'all') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', category);
    }
    history.replaceState(null, '', url);
  }

  // Tab clicks
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => filterBy(tab.dataset.category));
  });

  // Mobile select
  if (select) {
    select.addEventListener('change', () => filterBy(select.value));
  }

  // Read initial category from URL
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('category');
  if (initial) {
    filterBy(initial);
  }

})();
