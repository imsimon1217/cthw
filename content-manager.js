const CONTENT_STORAGE_KEY = "ychcthwps-site-content";
const ARTICLE_CATEGORY_LABELS = {
  school: "學校資訊",
  activity: "活動花絮",
  tender: "招標及行政公告",
  admission: "入學資訊",
  news: "最新消息"
};

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
    return normalizeContent(await fetchServerContent());
  } catch {
    return normalizeContent(getStoredContent() || await fetchDefaultContent());
  }
}

function normalizeContent(content) {
  content.news ||= {};
  content.news.items ||= [];
  content.news.items = content.news.items.map((item, index) => ({
    date: item.date || "最新消息",
    category: item.category || "news",
    slug: item.slug || `article-${index + 1}`,
    title: item.title || "",
    copy: item.copy || "",
    content: item.content || item.copy || "",
    image: item.image || "",
    linkHref: item.linkHref || "",
    showOnHome: item.showOnHome !== false
  }));
  return content;
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

function articleSlug(item, index = 0) {
  return item.slug || `article-${index + 1}`;
}

function articleHref(item, index = 0) {
  if (item.linkHref) return item.linkHref;
  return `article.html?slug=${encodeURIComponent(articleSlug(item, index))}`;
}

function articleCategoryLabel(item) {
  return ARTICLE_CATEGORY_LABELS[item.category] || item.date || "最新消息";
}

function publishedArticles(content) {
  return (content.news?.items || []).filter((item) => item.title && item.content);
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

  (content.news.items || []).filter((item) => item.showOnHome !== false).forEach((item, index) => {
    const hasDetail = item.content || item.linkHref;
    const article = createElement(hasDetail ? "a" : "article", hasDetail ? "news-card news-card-link" : "news-card");
    if (hasDetail) article.href = articleHref(item, index);
    article.append(
      createElement("p", "date", item.date || articleCategoryLabel(item)),
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

  renderTenderList(content);
}

function renderTenderList(content) {
  const list = document.querySelector("[data-tender-list]");
  if (!list) return;

  const tenders = publishedArticles(content).filter((item) => item.category === "tender");
  list.replaceChildren();

  if (!tenders.length) {
    const empty = createElement("p", "empty-state", content.tender?.content || "暫未有招標公告。");
    list.append(empty);
    return;
  }

  tenders.forEach((item, index) => {
    const link = createElement("a", "article-list-card");
    link.href = `article.html?slug=${encodeURIComponent(articleSlug(item, index))}`;
    link.append(
      createElement("span", "", item.date || articleCategoryLabel(item)),
      createElement("strong", "", item.title),
      createElement("p", "", item.copy || "")
    );
    list.append(link);
  });
}

function applyArticlePage(content) {
  if (!document.querySelector("[data-article-page]")) return;

  const slug = new URLSearchParams(window.location.search).get("slug") || "";
  const articles = publishedArticles(content);
  const item = articles.find((article, index) => articleSlug(article, index) === slug) || articles[0];
  const missing = !item || (slug && !articles.some((article, index) => articleSlug(article, index) === slug));

  document.querySelectorAll("[data-article-title]").forEach((element) => {
    element.textContent = missing ? "未能找到公告" : item.title;
  });
  document.querySelectorAll("[data-article-category]").forEach((element) => {
    element.textContent = missing ? "Notice" : articleCategoryLabel(item);
  });
  document.querySelectorAll("[data-article-date]").forEach((element) => {
    element.textContent = missing ? "" : item.date || "";
  });
  document.querySelectorAll("[data-article-summary]").forEach((element) => {
    element.textContent = missing ? "請返回最新消息查看現有公告。" : item.copy || "";
  });
  document.querySelectorAll("[data-article-body]").forEach((element) => {
    element.textContent = missing ? "這篇公告可能已被移除，或連結已經更新。" : item.content || item.copy || "";
  });

  const image = document.querySelector("[data-article-image]");
  if (image) {
    image.src = missing ? "assets/school-logo.png" : item.image || "assets/school-logo.png";
    image.alt = missing ? "仁濟醫院趙曾學韞小學校徽" : item.title;
  }
}

function applyContactLinks(content) {
  const phone = content.contact?.phone || "";
  const email = content.contact?.email || "";
  document.querySelectorAll("[data-contact-phone]").forEach((link) => {
    link.href = "tel:" + phone.replace(/\s+/g, "");
  });
  document.querySelectorAll("[data-contact-email]").forEach((link) => {
    link.href = "mailto:" + email;
  });
}

function applyContent(content) {
  document.querySelectorAll("[data-content]").forEach((element) => {
    const value = getByPath(content, element.dataset.content);
    if (typeof value === "string") element.textContent = value;
  });
  renderNews(content);
  renderCampus(content);
  applyTenderContent(content);
  applyArticlePage(content);
  applyContactLinks(content);
}
