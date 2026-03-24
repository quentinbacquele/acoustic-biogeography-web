import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Initialize parallax effect
function initParallax() {
  const landingBg = document.querySelector('.landing-bg');
  const landingSection = document.querySelector('.landing-section');
  const mapSection = document.querySelector('.map-section');

  if (!landingBg || !landingSection) return;

  // Create parallax effect where background moves slower than scroll
  // This creates the "stuck" effect
  gsap.to(landingBg, {
    y: () => window.innerHeight * 0.5, // Move down as we scroll
    ease: 'none',
    scrollTrigger: {
      trigger: landingSection,
      start: 'top top',
      end: 'bottom top',
      scrub: true // Smooth scrubbing effect
    }
  });

  // Nav bar color change based on scroll position
  if (mapSection) {
    ScrollTrigger.create({
      trigger: mapSection,
      start: 'top 140px', // When map section is 140px from top (nav height)
      end: 'bottom top',
      onEnter: () => {
        gsap.to('.nav a, .nav-links a', { color: '#ffffff', duration: 0.3 });
      },
      onLeaveBack: () => {
        gsap.to('.nav a, .nav-links a', { color: '#4a4a4a', duration: 0.3 });
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initParallax);
} else {
  initParallax();
}
