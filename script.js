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
  projectRail.addEventListener("wheel", (event) => {
    const isDesktopGallery = window.matchMedia("(min-width: 761px)").matches;

    if (isDesktopGallery && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      projectRail.scrollBy({ left: event.deltaY, behavior: "smooth" });
    }
  }, { passive: false });

  projectRail.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      projectRail.scrollBy({ left: direction * 420, behavior: "smooth" });
    }
  });

  let startX = 0;
  let startScrollLeft = 0;
  let activePointerId = null;

  projectRail.addEventListener("pointerdown", (event) => {
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
