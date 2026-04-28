// Initialize parallax effect
function initParallax() {
  const landingBg = document.querySelector('.landing-bg');
  const landingSection = document.querySelector('.landing-section');
  const mapSection = document.querySelector('.map-section');

  if (!landingBg || !landingSection) return;

  const navLinks = document.querySelectorAll('.nav a, .nav-links a');
  let ticking = false;

  const update = () => {
    const landingRect = landingSection.getBoundingClientRect();
    const offset = Math.max(0, -landingRect.top) * 0.5;
    landingBg.style.transform = `translate3d(0, ${offset}px, 0)`;

    if (mapSection) {
      const mapRect = mapSection.getBoundingClientRect();
      const onMap = mapRect.top <= 140 && mapRect.bottom > 140;
      navLinks.forEach((link) => {
        link.style.color = onMap ? '#ffffff' : '#4a4a4a';
      });
    }

    ticking = false;
  };

  const requestUpdate = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  update();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initParallax);
} else {
  initParallax();
}
