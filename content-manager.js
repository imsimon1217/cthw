const CONTENT_STORAGE_KEY = "ychcthwps-site-content";

async function fetchDefaultContent() {
  const response = await fetch("data/site-content.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Cannot load content file");
  return response.json();
}

async function fetchServerContent() {
  const response = await fetch("api/content.php", {
    cache: "no-store",
    credentials: "same-origin"
  });
  if (!response.ok) throw new Error("Cannot load server content");
  const payload = await response.json();
  return payload.content || payload;
}

function getStoredContent() {
  try {
    const raw = localStorage.getItem(CONTENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredContent(content) {
  localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(content));
}

function clearStoredContent() {
  localStorage.removeItem(CONTENT_STORAGE_KEY);
}

async function loadSiteContent() {
  try {
    return await fetchServerContent();
  } catch {
    return getStoredContent() || await fetchDefaultContent();
  }
}

function getByPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value || "";
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderNews(content) {
  const grid = document.querySelector("[data-news-grid]");
  if (!grid || !content.news) return;

  grid.replaceChildren();

  const featured = createElement("article", "feature-news");
  featured.append(
    createElement("p", "date", content.news.featured?.date),
    createElement("h3", "", content.news.featured?.title),
    createElement("p", "", content.news.featured?.copy)
  );
  const featuredLink = createElement("a", "", content.news.featured?.linkLabel || "查看詳情");
  featuredLink.href = content.news.featured?.linkHref || "#news";
  featured.append(featuredLink);
  grid.append(featured);

  (content.news.items || []).forEach((item) => {
    const article = createElement(item.linkHref ? "a" : "article", item.linkHref ? "news-card news-card-link" : "news-card");
    if (item.linkHref) {
      article.href = item.linkHref;
    }
    article.append(
      createElement("p", "date", item.date),
      createElement("h3", "", item.title),
      createElement("p", "", item.copy)
    );
    grid.append(article);
  });
}

function renderCampus(content) {
  const gallery = document.querySelector("[data-campus-gallery]");
  if (!gallery || !content.campus?.images) return;

  gallery.replaceChildren();
  content.campus.images.forEach((image) => {
    const figure = createElement("figure");
    const img = createElement("img");
    img.src = image.src || "";
    img.alt = image.alt || image.title || "校園環境";
    const caption = createElement("figcaption", "", image.title || "校園環境");
    figure.append(img, caption);
    gallery.append(figure);
  });
}

function applyTenderContent(content) {
  if (!document.querySelector("[data-tender-page]")) return;
  const tender = content.tender || {};
  document.querySelectorAll("[data-tender-content]").forEach((element) => {
    const value = getByPath(content, element.dataset.tenderContent);
    if (typeof value === "string") element.textContent = value;
  });

  const image = document.querySelector("[data-tender-image]");
  if (image) {
    image.src = tender.image || "assets/school-logo.png";
    image.alt = tender.imageAlt || tender.title || "招標及行政公告";
  }
}

function applyContent(content) {
  document.querySelectorAll("[data-content]").forEach((element) => {
    const value = getByPath(content, element.dataset.content);
    if (typeof value === "string") element.textContent = value;
  });
  renderNews(content);
  renderCampus(content);
  applyTenderContent(content);
}
