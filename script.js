//MOBILE NAV HAMBURGER ICON OPEN/CLOSE LOGIC
// Ensure page starts at top on load (prevents scroll restoration to footer)
// FORCE TOP ON REFRESH (desktop + mobile + Safari)
(function () {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const forceTop = () => {
    // Clear hash so anchors can't pull you back down on reload
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }

    // Aggressive top (covers Safari + quirky cases)
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  // Run early + multiple lifecycle events
  forceTop();
  window.addEventListener('DOMContentLoaded', forceTop, { once: true });
  window.addEventListener('load', forceTop);

  // Expose for the preloader to call at the right time
  window.__forceTop = forceTop;
})();


function toggleMenu() {
    const menu = document.querySelector('.hamburgerMenu');
    const icon = document.querySelector('.hamburgerIcon');
    menu.classList.toggle('open');
    icon.classList.toggle('open');
}

function scrollToSection(id) {
  toggleMenu();
  const el = document.getElementById(id);
  if (!el) return;
  setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

//LOADING SCREEN LOGIC
(() => {
    const overlay = document.getElementById('preloader');
    const percentEl = document.getElementById('percent');
    const fillEl = document.querySelector('.battery-fill');
    const dots = document.getElementById('dots');
  
    // Configuration
    const TOTAL_TIME = 10_000; // 60 seconds
    const START_TIME = performance.now();
    const EASE = t => 1 - Math.pow(1 - t, 3); // easeOutCubic
  
    function animate() {
      const elapsed = performance.now() - START_TIME;
      const progress = Math.min(1, elapsed / TOTAL_TIME);
      const eased = EASE(progress);
  
      const percent = Math.round(eased * 100);
      fillEl.style.setProperty('--progress', percent);
      percentEl.textContent = percent + '%';
  
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Fully loaded — fade out
        setTimeout(() => {
          overlay.classList.add('hidden');
          setTimeout(() => overlay.remove(), 800);
        }, 400);
      }
    }
    requestAnimationFrame(animate);
  
    // Animated dots
    setInterval(() => {
      dots.textContent = dots.textContent.length < 3 ? dots.textContent + '.' : '.';
    }, 400);
  })();


  //DEPLOYMENT SCROLL LOGIC
  const cards = document.querySelectorAll('.t-card');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = 1;
      entry.target.style.transform = "translateY(0)";
    }
  });
}, { threshold: 0.2 });

cards.forEach(card => {
  card.style.opacity = 0;
  card.style.transform = "translateY(40px)";
  observer.observe(card);
});

//NAV MODE BUTTON LOGIC
(() => {
  const toggle = document.getElementById("modeToggle");
  const root = document.documentElement;

  function setMode(mode) {
    root.setAttribute("data-mode", mode);
    localStorage.setItem("dw_mode", mode);

    if (toggle) {
      const isCreator = mode === "creator";
      toggle.setAttribute("aria-pressed", String(isCreator));
      toggle.textContent = isCreator ? "Creator Mode" : "Developer Mode";
    }
  }

  // Load saved preference
  const saved = localStorage.getItem("dw_mode");
  setMode(saved === "creator" ? "creator" : "dev");

  // Toggle on click
  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = root.getAttribute("data-mode") || "dev";
      setMode(current === "creator" ? "dev" : "creator");

      // Reset walker to start position
      const walker = document.getElementById('walker');
      if (walker) {
        walker.style.left = '5%';
        const legLeft = walker.querySelector('.leg-left');
        const legRight = walker.querySelector('.leg-right');
        const armLeft = walker.querySelector('.arm-left');
        const armRight = walker.querySelector('.arm-right');
        const handbag = walker.querySelector('#handbag');
        const walkerBody = walker.querySelector('#walkerBody');
        const walkerHead = walker.querySelector('#walkerHead');

        legLeft.setAttribute('x1', '32'); legLeft.setAttribute('y1', '34'); legLeft.setAttribute('x2', '28'); legLeft.setAttribute('y2', '50');
        legRight.setAttribute('x1', '32'); legRight.setAttribute('y1', '34'); legRight.setAttribute('x2', '36'); legRight.setAttribute('y2', '50');
        armLeft.setAttribute('x1', '32'); armLeft.setAttribute('y1', '20'); armLeft.setAttribute('x2', '22'); armLeft.setAttribute('y2', '30');
        armRight.setAttribute('x1', '32'); armRight.setAttribute('y1', '20'); armRight.setAttribute('x2', '42'); armRight.setAttribute('y2', '30');
        handbag.style.transform = '';
        walkerBody.style.transform = '';
        walkerHead.style.transform = '';
      }
    });
  }
})();

//ABOUT LOGIC
// Scroll reveal for About cards
document.querySelectorAll("#about .card").forEach((el) => {
  el.style.opacity = 0;
  el.style.transform = "translateY(18px)";
});

const aboutObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.style.opacity = 1;
      e.target.style.transform = "translateY(0)";
      e.target.style.transition = "opacity .6s ease, transform .6s ease";
      aboutObs.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll("#about .card").forEach((el) => aboutObs.observe(el));


//SCROLL FIGURE SCREEN LOGIC
(() => {
  const strip = document.getElementById('skill-rail-wrap') || document.querySelector('.skill-rail-wrap');
  const walker = document.getElementById('walker');
  if (!strip || !walker) return;

  // SVG limb groups
  const armL = walker.querySelector("#armL");
  const armR = walker.querySelector("#armR");
  const legL = walker.querySelector("#legL");
  const legR = walker.querySelector("#legR");

  // Keep inside the strip
  const padding = 18;
  let lastX = 0;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function update() {
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    const progress = window.scrollY / maxScroll;

    const stripWidth = strip.clientWidth;
    const walkerWidth = walker.offsetWidth;

    // Move left → right across the strip
    const minX = padding;
    const maxX = stripWidth - padding - walkerWidth;
    const x = clamp(minX + (maxX - minX) * progress, minX, maxX);

    // Walk cycle: speed tied to scroll
    const t = progress * 22; // more = faster steps
    const swing = Math.sin(t * Math.PI * 2) * 18; // degrees
    const bounce = Math.abs(Math.sin(t * Math.PI * 2)) * 6; // px

    // Slight lean based on movement direction
    const dir = x - lastX;
    const lean = clamp(dir * 0.15, -10, 10); // degrees
    lastX = x;

    walker.style.transform = `translateX(${x}px) translateY(${0 - bounce}px) rotate(${lean}deg)`;

    // Rotate limbs around approximate joints
    if (armL) armL.setAttribute("transform", `rotate(${swing} 32 24)`);
    if (armR) armR.setAttribute("transform", `rotate(${-swing} 32 24)`);
    if (legL) legL.setAttribute("transform", `rotate(${-swing} 32 38)`);
    if (legR) legR.setAttribute("transform", `rotate(${swing} 32 38)`);
  }

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
})();

const walker = document.getElementById("walker");
const skills = document.querySelectorAll(".skill-item");

let index = 0;

function moveWalker(){

  const skill = skills[index];
  const rail = skill.parentElement.getBoundingClientRect();
  const rect = skill.getBoundingClientRect();

  const center = rect.left - rail.left + rect.width / 2;

  walker.style.left = center - 32 + "px";

  skills.forEach(s => s.classList.remove("active"));
  skill.classList.add("active");

  index++;

  if(index >= skills.length){
    index = 0;
  }
}

moveWalker();

setInterval(moveWalker,1500);