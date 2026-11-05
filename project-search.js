function projectSearchWords(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

function projectSearchScore(project, query) {
  const terms = projectSearchWords(query);
  if (!terms.length) return 0;
  const titleWords = projectSearchWords(project.title);
  const topicWords = projectSearchWords(project.keywords);
  const descriptionWords = projectSearchWords(project.description);
  const title = titleWords.join(" ");
  let score = 0;

  for (const term of terms) {
    if (title.startsWith(term)) score += 400;
    else if (titleWords.some((word) => word.startsWith(term))) score += 180;
    else if (term.length > 1 && title.includes(term)) score += 100;
    else if (topicWords.some((word) => word.startsWith(term))) score += 90;
    else if (descriptionWords.some((word) => word.startsWith(term))) score += 45;
    else if (term.length > 1 && [...topicWords, ...descriptionWords].some((word) => word.includes(term))) score += 20;
    else return 0;
  }
  return score;
}

(() => {
  const search = document.querySelector(".project-search");
  if (!search) return;
  const input = search.querySelector("input");
  const clearButton = search.querySelector(".project-search-clear");
  const panel = search.querySelector(".project-search-panel");
  const results = search.querySelector(".project-search-results");
  const status = search.querySelector(".project-search-status");
  const empty = search.querySelector(".project-search-empty");
  const projects = Array.from(document.querySelectorAll(".gallery-project")).map((card) => ({
    title: card.querySelector("h1, h2").textContent.trim(),
    description: card.querySelector(".project-copy p").textContent.trim(),
    keywords: card.dataset.searchKeywords || "",
    href: card.querySelector(".gallery-project-link").getAttribute("href"),
    label: "Selected work / " + card.querySelector("figcaption").textContent.split("/").slice(1).join("/").trim(),
  }));
  projects.push(
    {
      title: "Data Center Parcel Suitability Agent: An Explainable Web-Based Screening Tool",
      description: "A proposed AI-assisted screening tool bringing flood exposure, power proximity, terrain, and community context into one transparent parcel report.",
      keywords: "data center infrastructure artificial intelligence AI agent GIS site suitability screening flood terrain power Philadelphia",
      href: "project-data-center-suitability.html",
      label: "In progress / Geospatial AI",
    },
    {
      title: "Mapping Health Accessibility in Philadelphia and Its Association with Socioeconomic Indicators",
      description: "A planned interactive GIS platform exploring healthcare availability, neighborhood conditions, and potential gaps in access across Philadelphia.",
      keywords: "health healthcare public health accessibility socioeconomic equity statistics spatial analysis Philadelphia",
      href: "project-philadelphia-health-accessibility.html",
      label: "In progress / Health accessibility",
    }
  );

  let matches = [];
  let activeIndex = -1;

  function closeSuggestions() {
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function selectSuggestion(index, scroll = true) {
    activeIndex = index;
    const options = Array.from(results.querySelectorAll('[role="option"]'));
    options.forEach((option, position) => option.setAttribute("aria-selected", String(position === index)));
    if (index < 0 || !options[index]) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    input.setAttribute("aria-activedescendant", options[index].id);
    if (scroll) options[index].scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function showSuggestions() {
    const query = input.value.trim();
    matches = projects.map((project, order) => ({ project, order, score: query ? projectSearchScore(project, query) : 1 }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map((item) => item.project);
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    results.replaceChildren();
    results.scrollTop = 0;
    matches.forEach((project, index) => {
      const item = document.createElement("li");
      item.setAttribute("role", "presentation");
      const link = document.createElement("a");
      link.className = "project-search-result";
      link.id = "project-search-option-" + index;
      link.href = project.href;
      link.tabIndex = -1;
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", "false");
      const title = document.createElement("strong");
      title.textContent = project.title;
      const label = document.createElement("span");
      label.textContent = project.label;
      link.append(title, label);
      link.addEventListener("pointerenter", () => selectSuggestion(index, false));
      item.append(link);
      results.append(item);
    });
    status.textContent = query ? matches.length + (matches.length === 1 ? " matching project" : " matching projects") : "Browse projects / " + projects.length;
    clearButton.hidden = !input.value;
    empty.hidden = matches.length > 0;
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  input.addEventListener("focus", showSuggestions);
  input.addEventListener("input", showSuggestions);
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (panel.hidden) showSuggestions();
      if (!matches.length) return;
      const next = event.key === "ArrowDown" ? (activeIndex + 1) % matches.length : activeIndex < 0 ? matches.length - 1 : (activeIndex - 1 + matches.length) % matches.length;
      selectSuggestion(next);
    } else if (event.key === "Enter" && !panel.hidden && matches.length && (activeIndex >= 0 || input.value.trim())) {
      event.preventDefault();
      window.location.assign(matches[activeIndex >= 0 ? activeIndex : 0].href);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions();
    }
  });
  clearButton.addEventListener("click", () => {
    input.value = "";
    input.focus();
    showSuggestions();
  });
  search.addEventListener("focusout", (event) => {
    if (!search.contains(event.relatedTarget)) closeSuggestions();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!search.contains(event.target)) closeSuggestions();
  });
})();
