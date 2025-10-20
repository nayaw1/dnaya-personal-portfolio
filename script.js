//TOGGLE LOGIC
function toggleMenu() {
    //targets a certain element on the webpage which is the menuLinks and hamburgerIcon class
    const menu = document.querySelector('.menuLinks');
    const icon = document.querySelector('.hamburgerIcon');
    //when the function is called it will toggle the class open for both menu and icon
    menu.classList.toggle('open');
    icon.classList.toggle('open');
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