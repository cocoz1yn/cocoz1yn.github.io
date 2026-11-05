const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".site-navigation");

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    navigation.classList.toggle("is-open", !isOpen);
  });
}

const projectRail = document.querySelector(".project-rail");

if (projectRail) {
  const reducedScrollMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let wheelTarget = projectRail.scrollLeft;
  let wheelFrame = 0;
  let wheelTime = 0;

  function stopWheelGlide() {
    cancelAnimationFrame(wheelFrame);
    wheelFrame = 0;
    wheelTarget = projectRail.scrollLeft;
  }

  function glideWheel(now) {
    wheelFrame = 0;
    if (!window.matchMedia("(min-width: 761px)").matches) return;
    const delta = Math.min(40, Math.max(1, now - wheelTime));
    wheelTime = now;
    wheelTarget = Math.max(0, Math.min(projectRail.scrollWidth - projectRail.clientWidth, wheelTarget));
    const remaining = wheelTarget - projectRail.scrollLeft;
    if (reducedScrollMotion.matches || Math.abs(remaining) <= 0.5) {
      projectRail.scrollLeft = wheelTarget;
      return;
    }
    // One short glide follows a shared target; new ticks never restart it.
    projectRail.scrollLeft += remaining * (1 - Math.exp(-delta / 85));
    wheelFrame = requestAnimationFrame(glideWheel);
  }

  projectRail.addEventListener("wheel", (event) => {
    const isDesktopGallery = window.matchMedia("(min-width: 761px)").matches;

    if (isDesktopGallery && !event.ctrlKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? projectRail.clientWidth : 1;
      const distance = event.deltaY * unit;
      if (reducedScrollMotion.matches) {
        stopWheelGlide();
        projectRail.scrollLeft += distance;
        return;
      }
      if (!wheelFrame) {
        wheelTarget = projectRail.scrollLeft;
        wheelTime = performance.now();
      }
      // Reversing direction responds immediately, without finishing the old glide.
      if (distance * (wheelTarget - projectRail.scrollLeft) < 0) wheelTarget = projectRail.scrollLeft;
      wheelTarget = Math.max(0, Math.min(projectRail.scrollWidth - projectRail.clientWidth, wheelTarget + distance));
      if (!wheelFrame) wheelFrame = requestAnimationFrame(glideWheel);
    } else {
      stopWheelGlide();
    }
  }, { passive: false });

  projectRail.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      stopWheelGlide();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      projectRail.scrollBy({ left: direction * 420, behavior: "smooth" });
    }
  });

  let startX = 0;
  let startScrollLeft = 0;
  let activePointerId = null;

  projectRail.addEventListener("pointerdown", (event) => {
    stopWheelGlide();
    if (!window.matchMedia("(min-width: 761px)").matches) return;
    if (event.button !== 0 || event.target.closest("a, button")) return;

    startX = event.clientX;
    startScrollLeft = projectRail.scrollLeft;
    activePointerId = event.pointerId;
    projectRail.setPointerCapture(event.pointerId);
  });

  projectRail.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId || !projectRail.hasPointerCapture(event.pointerId)) return;
    const distance = event.clientX - startX;
    projectRail.scrollLeft = startScrollLeft - distance;
  });

  projectRail.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activePointerId) return;
    if (projectRail.hasPointerCapture(event.pointerId)) projectRail.releasePointerCapture(event.pointerId);
    activePointerId = null;
  });

  projectRail.addEventListener("pointercancel", () => {
    activePointerId = null;
  });
}

const imageGalleries = document.querySelectorAll("[data-image-gallery]");

imageGalleries.forEach((gallery) => {
  const slides = Array.from(gallery.querySelectorAll(".gallery-slide"));
  const position = gallery.querySelector(".gallery-position");
  const previousButton = gallery.querySelector("[data-gallery-previous]");
  const nextButton = gallery.querySelector("[data-gallery-next]");
  let activeIndex = 0;

  const showSlide = (nextIndex) => {
    activeIndex = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      slide.hidden = !isActive;
      slide.classList.toggle("is-active", isActive);
    });
    position.textContent = slides[activeIndex].dataset.slideLabel;
  };

  previousButton.addEventListener("click", () => showSlide(activeIndex - 1));
  nextButton.addEventListener("click", () => showSlide(activeIndex + 1));
});
