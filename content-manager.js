const CONTENT_STORAGE_KEY = "ychcthwps-site-content";
const ARTICLE_CATEGORY_LABELS = { school: "學校資訊", activity: "活動花絮", tender: "招標及行政公告", admission: "入學資訊", news: "最新消息" };

async function fetchDefaultContent() {
  const response = await fetch("data/site-content.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Cannot load content file");
  return response.json();
}

async function fetchServerContent() {
  const response = await fetch("api/content.php", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Cannot load server content");
  const payload = await response.json();
  return payload.content || payload;
}

function getStoredContent() {
  try { return JSON.parse(localStorage.getItem(CONTENT_STORAGE_KEY) || "null"); } catch { return null; }
}
function saveStoredContent(content) {
  try {
    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(content));
  } catch {
    throw new Error("本機瀏覽器暫存空間不足，請使用較小圖片或在 PHP server 上載。");
  }
}
function clearStoredContent() { localStorage.removeItem(CONTENT_STORAGE_KEY); }

async function loadSiteContent() {
  try { return normalizeContent(await fetchServerContent()); }
  catch { return normalizeContent(getStoredContent() || await fetchDefaultContent()); }
}

function slugify(value, prefix = "item") {
  const ascii = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return ascii || `${prefix}-${Date.now()}`;
}

function normalizeContent(content) {
  content.categories ||= [];
  content.categories = content.categories.map((item, index) => ({
    id: item.id || `category-${index + 1}`,
    parentId: item.parentId || "",
    title: item.title || "未命名分類",
    description: item.description || "",
    image: item.image || "",
    visible: item.visible !== false
  }));
  content.news ||= {};
  content.news.items ||= [];
  content.news.items = content.news.items.map((item, index) => ({
    date: item.date || "最新消息", category: item.category || "news", categoryId: item.categoryId || "latest-news",
    slug: item.slug || `article-${index + 1}`, title: item.title || "", copy: item.copy || "",
    content: item.content || item.copy || "", image: item.image || "", linkHref: item.linkHref || "", showOnHome: item.showOnHome !== false
  }));
  return content;
}

function getByPath(source, path) { return path.split(".").reduce((value, key) => value?.[key], source); }
function setText(selector, value) { document.querySelectorAll(selector).forEach((element) => { element.textContent = value || ""; }); }
function createElement(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
function articleSlug(item, index = 0) { return item.slug || `article-${index + 1}`; }
function articleHref(item, index = 0) { return item.linkHref || `article.html?slug=${encodeURIComponent(articleSlug(item, index))}`; }
function categoryById(content, id) { return content.categories.find((category) => category.id === id); }
function categoryImage(category, content) {
  const visited = new Set();
  let current = category;
  while (current && !visited.has(current.id)) {
    if (current.image) return current.image;
    visited.add(current.id);
    current = categoryById(content, current.parentId);
  }
  const article = publishedArticles(content).find((item) => item.categoryId === category?.id && item.image);
  return article?.image || "assets/campus-courtyard.jpg";
}
function articleCategoryLabel(item, content) { return categoryById(content, item.categoryId)?.title || ARTICLE_CATEGORY_LABELS[item.category] || item.date || "最新消息"; }
function publishedArticles(content) { return (content.news?.items || []).filter((item) => item.title && item.content); }
function categoryHref(id) { return `category.html?category=${encodeURIComponent(id)}`; }
function childCategories(content, parentId) { return content.categories.filter((item) => item.parentId === parentId && item.visible); }

function renderPrimaryNavigation(content) {
  document.querySelectorAll("[data-primary-nav]").forEach((nav) => {
    nav.replaceChildren();
    childCategories(content, "").forEach((category) => {
      const link = createElement("a", "", category.title);
      link.href = categoryHref(category.id);
      nav.append(link);
    });
  });
}

function renderNews(content) {
  const grid = document.querySelector("[data-news-grid]");
  if (!grid || !content.news) return;
  grid.replaceChildren();
  const featured = createElement("article", "feature-news");
  featured.append(createElement("p", "date", content.news.featured?.date), createElement("h3", "", content.news.featured?.title), createElement("p", "", content.news.featured?.copy));
  const featuredLink = createElement("a", "", content.news.featured?.linkLabel || "查看詳情");
  featuredLink.href = content.news.featured?.linkHref || "#news";
  featured.append(featuredLink);
  grid.append(featured);
  content.news.items.filter((item) => item.showOnHome).slice(0, 6).forEach((item, index) => {
    const card = createElement("a", "news-card news-card-link");
    card.href = articleHref(item, index);
    card.append(createElement("p", "date", articleCategoryLabel(item, content)), createElement("h3", "", item.title), createElement("p", "", item.copy));
    grid.append(card);
  });
}

function renderCampus(content) {
  const gallery = document.querySelector("[data-campus-gallery]");
  if (!gallery || !content.campus?.images) return;
  gallery.replaceChildren();
  content.campus.images.forEach((image) => {
    const figure = createElement("figure"); const img = createElement("img");
    img.src = image.src || ""; img.alt = image.alt || image.title || "校園環境";
    figure.append(img, createElement("figcaption", "", image.title || "校園環境")); gallery.append(figure);
  });
}

function renderCategoryPage(content) {
  if (!document.body.matches("[data-category-page]")) return;
  const id = new URLSearchParams(location.search).get("category") || content.categories.find((item) => !item.parentId)?.id;
  const category = categoryById(content, id);
  const title = category?.title || "內容分類";
  setText("[data-category-title]", title);
  setText("[data-category-description]", category?.description || "請從以下分類選擇內容。 ");
  document.title = `${title} | 仁濟醫院趙曾學韞小學`;
  const trail = document.querySelector("[data-category-trail]");
  if (trail) {
    trail.replaceChildren();
    const home = createElement("a", "", "首頁"); home.href = "index.html"; trail.append(home);
    if (category?.parentId) { const parent = categoryById(content, category.parentId); if (parent) { const parentLink = createElement("a", "", parent.title); parentLink.href = categoryHref(parent.id); trail.append(parentLink); } }
    trail.append(createElement("span", "", title));
  }
  const children = document.querySelector("[data-category-children]");
  if (children) {
    children.replaceChildren();
    childCategories(content, id).forEach((child) => {
      const link = createElement("a", "category-child-card");
      const image = createElement("img", "category-card-image");
      image.src = categoryImage(child, content); image.alt = `${child.title}分類封面`;
      const copy = createElement("div", "category-card-copy");
      copy.append(createElement("strong", "", child.title), createElement("span", "", child.description || "瀏覽內容"));
      link.href = categoryHref(child.id); link.append(image, copy); children.append(link);
    });
  }
  const list = document.querySelector("[data-category-articles]");
  if (!list) return;
  list.replaceChildren();
  const articles = publishedArticles(content).filter((item) => item.categoryId === id);
  if (!articles.length) { list.append(createElement("p", "empty-state", "此分類暫未有已發布內容。")); return; }
  articles.forEach((item, index) => {
    const link = createElement("a", "article-list-card");
    const image = createElement("img", "article-list-image");
    image.src = item.image || categoryImage(category, content); image.alt = `${item.title}封面`;
    const copy = createElement("div", "article-list-copy");
    copy.append(createElement("span", "", item.date || title), createElement("strong", "", item.title), createElement("p", "", item.copy));
    link.href = articleHref(item, index); link.append(image, copy); list.append(link);
  });
}

function applyTenderContent(content) {
  if (!document.querySelector("[data-tender-page]")) return;
  document.querySelectorAll("[data-tender-content]").forEach((element) => { const value = getByPath(content, element.dataset.tenderContent); if (typeof value === "string") element.textContent = value; });
  const image = document.querySelector("[data-tender-image]");
  if (image) { image.src = content.tender?.image || "assets/school-logo.png"; image.alt = content.tender?.imageAlt || content.tender?.title || "招標及行政公告"; }
  const list = document.querySelector("[data-tender-list]");
  if (!list) return;
  list.replaceChildren();
  const tenders = publishedArticles(content).filter((item) => item.category === "tender" || item.categoryId === "tenders");
  if (!tenders.length) { list.append(createElement("p", "empty-state", content.tender?.content || "暫未有招標公告。")); return; }
  tenders.forEach((item, index) => {
    const link = createElement("a", "article-list-card");
    const image = createElement("img", "article-list-image");
    image.src = item.image || categoryImage(categoryById(content, item.categoryId), content); image.alt = `${item.title}封面`;
    const copy = createElement("div", "article-list-copy");
    copy.append(createElement("span", "", item.date), createElement("strong", "", item.title), createElement("p", "", item.copy));
    link.href = articleHref(item, index); link.append(image, copy); list.append(link);
  });
}

function applyArticleContent(content) {
  if (!document.querySelector("[data-article-page]")) return;
  const slug = new URLSearchParams(location.search).get("slug");
  const articles = publishedArticles(content); const item = articles.find((article, index) => articleSlug(article, index) === slug) || articles[0];
  const missing = !item || (slug && !articles.some((article, index) => articleSlug(article, index) === slug));
  const label = missing ? "內容未找到" : articleCategoryLabel(item, content);
  setText("[data-article-title]", missing ? "找不到內容" : item.title); setText("[data-article-category]", label); setText("[data-article-date]", missing ? "" : item.date); setText("[data-article-summary]", missing ? "此內容不存在或尚未發布。" : item.copy);
  document.querySelectorAll("[data-article-body]").forEach((element) => { element.replaceChildren(); (missing ? ["請返回分類頁選擇其他內容。"] : item.content.split(/\n{2,}/)).forEach((paragraph) => element.append(createElement("p", "", paragraph))); });
  const image = document.querySelector("[data-article-image]"); if (image) { image.src = item?.image || categoryImage(categoryById(content, item?.categoryId), content); image.alt = item?.title || "仁濟醫院趙曾學韞小學"; }
  const back = document.querySelector("[data-article-back]"); if (back) { back.href = item?.categoryId ? categoryHref(item.categoryId) : "index.html#news"; back.textContent = `返回${label}`; }
  document.title = `${missing ? "找不到內容" : item.title} | 仁濟醫院趙曾學韞小學`;
}

function applyContent(content) {
  document.querySelectorAll("[data-content]").forEach((element) => { const value = getByPath(content, element.dataset.content); if (typeof value === "string") element.textContent = value; });
  document.querySelectorAll("[data-contact-phone]").forEach((element) => { element.href = `tel:${content.contact?.phone || ""}`; });
  document.querySelectorAll("[data-contact-email]").forEach((element) => { element.href = `mailto:${content.contact?.email || ""}`; });
  const categoryHero = document.querySelector("[data-category-image]");
  if (categoryHero && document.body.matches("[data-category-page]")) {
    const id = new URLSearchParams(location.search).get("category") || content.categories.find((item) => !item.parentId)?.id;
    const category = categoryById(content, id);
    categoryHero.src = categoryImage(category, content); categoryHero.alt = `${category?.title || "網站內容"}分類封面`;
  }
  renderPrimaryNavigation(content); renderNews(content); renderCampus(content); renderCategoryPage(content); applyTenderContent(content); applyArticleContent(content);
}
