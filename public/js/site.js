document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav toggle
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-nav-menu]');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('is-open', !expanded);
    });
  }

  // Stagger children in .metrics-strip and .card-grid
  document.querySelectorAll('.metrics-strip, .card-grid').forEach(container => {
    Array.from(container.children).forEach((child, i) => {
      child.style.animationDelay = `${i * 0.1}s`;
    });
  });

  // Scroll-reveal via IntersectionObserver
  const revealObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // Counter animation for .metric-card strong elements
  function animateCounter(el) {
    const raw = el.textContent.replace(/,/g, '');
    const target = parseFloat(raw);
    if (isNaN(target)) return;

    const isFloat = raw.includes('.');
    const decimals = isFloat ? (raw.split('.')[1] || '').length : 0;
    const suffix = el.textContent.replace(/[\d.,]/g, '');
    const duration = 1200;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = eased * target;
      el.textContent = value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  const counterObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.metric-card strong').forEach(el => counterObserver.observe(el));
});

// Header scroll effect
window.addEventListener('scroll', () => {
  const header = document.querySelector('.site-header');
  if (header) {
    header.classList.toggle('is-scrolled', window.scrollY > 60);
  }
}, { passive: true });
