const CONTENT_STORAGE_KEY = "ychcthwps-site-content";
const LAYOUTS = {
  editorial: "專題導覽",
  community: "家校社群",
  news: "消息刊物",
  gallery: "相簿展覽",
  resources: "文件資料",
  admission: "入學指南",
  contact: "聯絡資訊",
};
const BLOCK_TYPES = {
  text: "文字段落",
  image: "單張圖片",
  feature: "圖文專題",
  gallery: "多圖相簿",
  callout: "重點提示",
  list: "重點清單",
  steps: "步驟流程",
  links: "文件及連結",
  faq: "常見問題",
};
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function safeURL(value, image = false) {
  const url = String(value || "").trim();
  if (image && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(url))
    return url;
  if (!url || /[\x00-\x20\\]/.test(url) || url.startsWith("//")) return "";
  if (/^(https?:|mailto:|tel:)/i.test(url) && (!image || /^https?:/i.test(url)))
    return url;
  return !/^[^/?#]*:/.test(url) ? url : "";
}
function createElement(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function getByPath(source, path) {
  return path.split(".").reduce((v, k) => v?.[k], source);
}
function setText(selector, value) {
  document.querySelectorAll(selector).forEach((e) => {
    e.textContent = value || "";
  });
}
function uid(prefix = "item") {
  return prefix + "-" + crypto.randomUUID();
}
function legacyBlocks(text) {
  return text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((part) => {
      const lines = part.split("\n");
      return {
        type: "text",
        heading: lines.length > 1 ? lines.shift() : "",
        text: lines.join("\n"),
      };
    });
}
function normalizeContent(input) {
  const content = structuredClone(input);
  content.categories = (content.categories || []).map((c, i) => ({
    ...c,
    id: c.id || "category-" + (i + 1),
    parentId: c.parentId || "",
    title: c.title || "未命名分類",
    description: c.description || "",
    image: c.image || "",
    visible: c.visible !== false,
    layout: LAYOUTS[c.layout] ? c.layout : "editorial",
    entryMode: c.entryMode === "auto" ? "auto" : "page",
    blocks: Array.isArray(c.blocks) ? c.blocks : [],
  }));
  content.news ||= {};
  content.news.items ||= [];
  content.news.items = content.news.items.map((a, i) => ({
    ...a,
    slug: a.slug || "article-" + (i + 1),
    title: a.title || "",
    categoryId: a.categoryId || "latest-news",
    date: a.date || "",
    copy: a.copy || "",
    content: a.content || "",
    image: a.image || "",
    status: a.status === "draft" ? "draft" : "published",
    format: a.format || "story",
    showOnHome: a.showOnHome !== false,
    pinned: !!a.pinned,
    blocks: Array.isArray(a.blocks)
      ? a.blocks
      : legacyBlocks(a.content || a.copy || ""),
  }));
  return content;
}
async function fetchDefaultContent() {
  const r = await fetch("data/site-content.json", { cache: "no-store" });
  if (!r.ok) throw Error("未能讀取內容資料");
  return r.json();
}
async function fetchServerContent() {
  const r = await fetch("api/content.php", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!r.ok) throw Error("未能連接內容服務");
  const p = await r.json();
  return p.content || p;
}
function localDatabase(action, value) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("ych-school-cms", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("content");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(
        "content",
        action === "get" ? "readonly" : "readwrite",
      );
      const s = tx.objectStore("content");
      const req =
        action === "get"
          ? s.get("site")
          : action === "clear"
            ? s.delete("site")
            : s.put(value, "site");
      tx.oncomplete = () => {
        db.close();
        resolve(req.result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
async function getStoredContent() {
  const stored = await localDatabase("get").catch(() => null);
  if (stored) return stored;
  try {
    return JSON.parse(localStorage.getItem(CONTENT_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}
async function saveStoredContent(content) {
  await localDatabase("put", content);
}
async function clearStoredContent() {
  await localDatabase("clear");
  localStorage.removeItem(CONTENT_STORAGE_KEY);
}
async function loadSiteContent() {
  if (new URLSearchParams(location.search).get("preview") === "1") {
    const p = sessionStorage.getItem("ych-content-preview");
    if (p) return normalizeContent(JSON.parse(p));
  }
  try {
    return normalizeContent(await fetchServerContent());
  } catch {
    const defaults = await fetchDefaultContent(),
      stored = await getStoredContent();
    if (!stored) return normalizeContent(defaults);
    if ((stored.schemaVersion || 1) < 2) {
      const merged = structuredClone(defaults);
      const baseline = await fetch("data/content-v1-baseline.json")
        .then((r) => r.json())
        .catch(() => ({ categories: [], news: { items: [] } }));
      // Compare with the previous shipped version to retain genuine teacher edits.
      for (const key of ["categories", "articles"]) {
        const oldItems =
          key === "categories"
            ? stored.categories || []
            : stored.news?.items || [];
        const newItems =
            key === "categories" ? merged.categories : merged.news.items,
          id = key === "categories" ? "id" : "slug";
        const baseItems =
          key === "categories"
            ? baseline.categories || []
            : baseline.news?.items || [];
        for (const old of oldItems) {
          const match = newItems.find((x) => x[id] === old[id]),
            base = baseItems.find((x) => x[id] === old[id]);
          if (!match) {
            newItems.push(old);
            continue;
          }
          if (!base) continue;
          for (const [field, value] of Object.entries(old)) {
            if (
              JSON.stringify(value) !==
              JSON.stringify(
                base[field] ?? (typeof value === "string" ? "" : undefined),
              )
            ) {
              match[field] = value;
              if (field === "content") match.blocks = legacyBlocks(value);
            }
          }
        }
        const removed = new Set(
          baseItems
            .filter((x) => !oldItems.some((y) => y[id] === x[id]))
            .map((x) => x[id]),
        );
        for (let i = newItems.length - 1; i >= 0; i--)
          if (removed.has(newItems[i][id])) newItems.splice(i, 1);
      }
      for (const key of [
        "hero",
        "about",
        "campus",
        "admission",
        "contact",
        "tender",
      ])
        if (
          stored[key] &&
          JSON.stringify(stored[key]) !== JSON.stringify(baseline[key])
        )
          merged[key] = stored[key];
      return normalizeContent(merged);
    }
    return normalizeContent(stored);
  }
}
function categoryById(content, id) {
  return content.categories.find((c) => c.id === id);
}
function categoryEntryArticle(content, id) {
  if (!content || !categoryVisible(content, id)) return null;
  const category = categoryById(content, id);
  if (category?.entryMode !== "auto") return null;
  const articles = categoryArticles(content, id);
  return articles.length === 1 ? articles[0] : null;
}
function categoryHref(id, content) {
  const article = categoryEntryArticle(content, id);
  if (article) return "article.html?slug=" + encodeURIComponent(article.slug);
  return "category.html?category=" + encodeURIComponent(id);
}
function categoryRedirectHref(id, search = "", content) {
  if (!categoryEntryArticle(content, id)) return "";
  return (
    categoryHref(id, content) +
    (new URLSearchParams(search).get("preview") === "1" ? "&preview=1" : "")
  );
}
function articleReturnCategory(content, article) {
  let category = categoryById(content, article.categoryId);
  const visited = new Set();
  while (
    category &&
    categoryEntryArticle(content, category.id)?.slug === article.slug
  ) {
    if (visited.has(category.id)) return null;
    visited.add(category.id);
    category = categoryById(content, category.parentId);
  }
  return category;
}

// Resolve stored category links at render time, so a second published article
// automatically restores a collection without editing every incoming link.
function resolveCategoryLink(href, content) {
  const match = String(href || "").match(
    /^(?:\.\/)?category\.html\?([^#]*)(#.*)?$/,
  );
  if (!match) return href;
  const params = new URLSearchParams(match[1]);
  const id = params.get("category");
  if (!categoryById(content, id) || !categoryVisible(content, id)) return null;
  if (!categoryEntryArticle(content, id)) return href;
  return (
    categoryHref(id, content) +
    (params.get("preview") === "1" ? "&preview=1" : "")
  );
}
function applyCategoryLinks(content) {
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = resolveCategoryLink(link.getAttribute("href"), content);
    if (href === null) link.remove();
    else link.setAttribute("href", href);
  });
}
function articleSlug(a) {
  return a.slug;
}
function articleHref(a) {
  return (
    safeURL(a.linkHref) || "article.html?slug=" + encodeURIComponent(a.slug)
  );
}
function categoryVisible(content, id) {
  const visited = new Set();
  const preview =
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("preview") === "1";
  let c = categoryById(content, id);
  while (c) {
    if ((!c.visible && !preview) || visited.has(c.id)) return false;
    visited.add(c.id);
    c = categoryById(content, c.parentId);
  }
  return true;
}
function childCategories(content, id) {
  return content.categories.filter(
    (c) => c.parentId === id && categoryVisible(content, c.id),
  );
}
function descendantIds(content, id) {
  const found = new Set([id]);
  let size;
  do {
    size = found.size;
    content.categories.forEach((c) => {
      if (found.has(c.parentId) && categoryVisible(content, c.id))
        found.add(c.id);
    });
  } while (size !== found.size);
  return found;
}
function publishedArticles(content) {
  return content.news.items.filter(
    (a) =>
      a.title && a.status !== "draft" && categoryVisible(content, a.categoryId),
  );
}
function categoryArticles(content, id) {
  const ids = descendantIds(content, id);
  return publishedArticles(content)
    .filter((a) => ids.has(a.categoryId))
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        (b.publishedAt || "").localeCompare(a.publishedAt || ""),
    );
}
function articleCategoryLabel(a, content) {
  return categoryById(content, a.categoryId)?.title || "校園消息";
}
function categoryImage(c) {
  return safeURL(c?.image, true);
}
const IMPORTED_IMAGE_ROTATIONS = {
  "assets/imported/english/image2.jpeg": 90,
  "assets/imported/english/image11.jpeg": 90,
};
function imageRotation(src, rotation) {
  const value =
    rotation === undefined
      ? IMPORTED_IMAGE_ROTATIONS[src] || 0
      : Number(rotation);
  return [0, 90, 180, 270].includes(value) ? value : 0;
}
function rotationPath(path) {
  return path.replace(/\.(image|src)$/, (_, key) =>
    key === "image" ? ".imageRotation" : ".rotation",
  );
}
let imageOrientationObserver, imageOrientationMutations;
function setupImageOrientations() {
  if (imageOrientationObserver || typeof document === "undefined") return;
  const update = (frame) => {
    const img = frame.querySelector("img"),
      odd = Number(frame.dataset.rotation) % 180;
    if (!img) return;
    img.style.width = (odd ? frame.clientHeight : frame.clientWidth) + "px";
    img.style.height = (odd ? frame.clientWidth : frame.clientHeight) + "px";
  };
  imageOrientationObserver = new ResizeObserver((entries) =>
    entries.forEach((e) => update(e.target)),
  );
  const frames = new Set();
  const scan = () => {
    frames.forEach((f) => {
      if (!f.isConnected) {
        imageOrientationObserver.unobserve(f);
        frames.delete(f);
      }
    });
    document.querySelectorAll(".oriented-media").forEach((f) => {
      if (!frames.has(f)) {
        frames.add(f);
        imageOrientationObserver.observe(f);
      }
      update(f);
    });
  };
  imageOrientationMutations = new MutationObserver(scan);
  imageOrientationMutations.observe(document.body, {
    childList: true,
    subtree: true,
  });
  scan();
}
function imageMarkup(src, alt, cls = "", eager = false, rotation) {
  const url = safeURL(src, true);
  if (!url) return "";
  const angle = imageRotation(src, rotation);
  const img =
    '<img class="' +
    esc(angle ? "" : cls) +
    '" src="' +
    esc(url) +
    '" alt="' +
    esc(alt) +
    '" loading="' +
    (eager ? "eager" : "lazy") +
    '" decoding="async">';
  return angle
    ? '<span class="oriented-media ' +
        esc(cls) +
        '" data-rotation="' +
        angle +
        '" style="--image-angle:' +
        angle +
        'deg">' +
        img +
        "</span>"
    : img;
}
function paragraphs(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((t) => "<p>" + esc(t).replace(/\n/g, "<br>") + "</p>")
    .join("");
}
function renderBlocks(blocks, target, prefix = "section") {
  target.replaceChildren();
  (blocks || []).forEach((b, i) => {
    const section = createElement(
      "section",
      "content-block block-" + (BLOCK_TYPES[b.type] ? b.type : "text"),
    );
    section.id = prefix + "-" + i;
    const heading = b.heading ? "<h2>" + esc(b.heading) + "</h2>" : "",
      text = b.text ? paragraphs(b.text) : "";
    if (b.type === "feature") {
      section.innerHTML =
        "<figure>" +
        imageMarkup(b.src, b.alt || b.heading, "", false, b.rotation) +
        (b.caption ? "<figcaption>" + esc(b.caption) + "</figcaption>" : "") +
        '</figure><div class="feature-copy">' +
        heading +
        text +
        (safeURL(b.href)
          ? '<a class="feature-link" href="' +
            esc(safeURL(b.href)) +
            '">' +
            esc(b.label || "了解更多") +
            ' <span aria-hidden="true">↗</span></a>'
          : "") +
        "</div>";
    } else if (b.type === "image")
      section.innerHTML =
        heading +
        "<figure>" +
        imageMarkup(
          b.src,
          b.alt || b.caption || b.heading,
          "",
          false,
          b.rotation,
        ) +
        (b.caption ? "<figcaption>" + esc(b.caption) + "</figcaption>" : "") +
        "</figure>" +
        text;
    else if (b.type === "gallery")
      section.innerHTML =
        heading +
        text +
        '<div class="photo-grid">' +
        (b.images || [])
          .filter((p) => safeURL(p.src, true))
          .map(
            (p) =>
              '<figure><button type="button" class="photo-open" data-photo-src="' +
              esc(safeURL(p.src, true)) +
              '" data-photo-rotation="' +
              imageRotation(p.src, p.rotation) +
              '" data-photo-caption="' +
              esc(p.caption || p.alt || "校園相片") +
              '" aria-label="放大：' +
              esc(p.caption || p.alt || "校園相片") +
              '">' +
              imageMarkup(p.src, p.alt || p.caption, "", false, p.rotation) +
              "<span>放大相片 ↗</span></button><figcaption>" +
              esc(p.caption) +
              "</figcaption></figure>",
          )
          .join("") +
        "</div>";
    else if (b.type === "list" || b.type === "steps") {
      const tag = b.type === "steps" ? "ol" : "ul";
      section.innerHTML =
        heading +
        text +
        "<" +
        tag +
        ' class="' +
        (b.type === "steps" ? "step-list" : "detail-list") +
        '">' +
        (b.items || []).map((t) => "<li>" + esc(t) + "</li>").join("") +
        "</" +
        tag +
        ">";
    } else if (b.type === "links")
      section.innerHTML =
        heading +
        text +
        '<div class="resource-links">' +
        (b.links || [])
          .filter((l) => safeURL(l.href))
          .map(
            (l) =>
              '<a href="' +
              esc(safeURL(l.href)) +
              '"' +
              (/^https?:/.test(l.href)
                ? ' target="_blank" rel="noopener noreferrer"'
                : "") +
              '><span class="document-icon" aria-hidden="true">↗</span><span><strong>' +
              esc(l.label) +
              "</strong><small>" +
              esc(l.description || "開啟資料") +
              '</small></span><span aria-hidden="true">→</span></a>',
          )
          .join("") +
        "</div>";
    else if (b.type === "faq")
      section.innerHTML =
        heading +
        (b.items || [])
          .map((t) => {
            const [q, ...a] = t.split("\n");
            return (
              "<details><summary>" +
              esc(q) +
              "</summary>" +
              paragraphs(a.join("\n")) +
              "</details>"
            );
          })
          .join("");
    else section.innerHTML = heading + text;
    target.append(section);
  });
}
function cardMarkup(a, content, mode = "story") {
  const cover =
    a.image || a.blocks.find((b) => b.type === "gallery")?.images?.[0]?.src;
  const count = a.blocks.reduce(
    (n, b) =>
      n +
      (b.type === "gallery"
        ? b.images?.length || 0
        : b.type === "image"
          ? 1
          : 0),
    0,
  );
  return (
    '<a class="story-card ' +
    mode +
    "-card " +
    (!cover ? "text-only" : "") +
    '" href="' +
    esc(articleHref(a)) +
    '">' +
    (cover
      ? '<div class="story-media">' +
        imageMarkup(
          cover,
          a.imageAlt || a.title,
          "",
          false,
          a.image
            ? a.imageRotation
            : a.blocks.find((b) => b.type === "gallery")?.images?.[0]?.rotation,
        ) +
        (a.format === "album"
          ? '<span class="photo-count">' + count + " 張相片</span>"
          : "") +
        "</div>"
      : mode === "resource"
        ? '<span class="document-icon" aria-hidden="true">↗</span>'
        : "") +
    '<div class="story-copy"><p class="story-meta">' +
    (a.pinned ? '<span class="pin-label">置頂</span> ' : "") +
    esc(articleCategoryLabel(a, content)) +
    (a.publishedAt
      ? ' <time datetime="' +
        esc(a.publishedAt) +
        '">' +
        esc(a.publishedAt) +
        "</time>"
      : "") +
    "</p><h3>" +
    esc(a.title) +
    "</h3><p>" +
    esc(a.copy) +
    '</p><span class="read-more">' +
    (a.format === "album" ? "打開相簿" : "閱讀全文") +
    ' <span aria-hidden="true">↗</span></span></div></a>'
  );
}
function renderPrimaryNavigation(content) {
  document.querySelectorAll("[data-primary-nav]").forEach((nav) => {
    nav.innerHTML = childCategories(content, "")
      .map(
        (c) =>
          '<a href="' +
          categoryHref(c.id, content) +
          '">' +
          esc(c.title) +
          "</a>",
      )
      .join("");
  });
}
function renderNews(content) {
  const grid = document.querySelector("[data-news-grid]");
  if (!grid) return;
  grid.className = "home-journal";
  grid.innerHTML = publishedArticles(content)
    .filter((a) => a.showOnHome)
    .slice(0, 6)
    .map((a) => cardMarkup(a, content))
    .join("");
}
function renderCampus(content) {
  const gallery = document.querySelector("[data-campus-gallery]");
  if (gallery)
    gallery.innerHTML = (content.campus?.images || [])
      .map(
        (p) =>
          "<figure>" +
          imageMarkup(p.src, p.alt || p.title, "", false, p.rotation) +
          "<figcaption>" +
          esc(p.title) +
          "</figcaption></figure>",
      )
      .join("");
}
function trailMarkup(content, c) {
  const trail = [],
    visited = new Set();
  while (c && !visited.has(c.id)) {
    visited.add(c.id);
    trail.unshift(
      '<a href="' + categoryHref(c.id, content) + '">' + esc(c.title) + "</a>",
    );
    c = categoryById(content, c.parentId);
  }
  return (
    '<a href="index.html">首頁</a>' +
    trail.map((t) => '<span aria-hidden="true">/</span>' + t).join("")
  );
}

function categoryHeroMarkup(c, children, content) {
  const special = ["community", "admission"].includes(c.layout);
  const photos = [
    {
      src: c.image,
      alt: c.imageAlt || c.title,
      caption: c.imageCaption,
      rotation: c.imageRotation,
    },
    ...(c.heroImages || []),
  ].filter((p) => safeURL(p.src, true));
  const actions =
    special && children.length
      ? '<div class="hero-pathways">' +
        children
          .map(
            (x) =>
              '<a href="' +
              categoryHref(x.id, content) +
              '">' +
              esc(x.title) +
              ' <span aria-hidden="true">↗</span></a>',
          )
          .join("") +
        "</div>"
      : "";
  return (
    '<header class="editorial-hero ' +
    (photos.length ? "has-image " : "") +
    (special ? "portal-hero portal-" + c.layout : "") +
    '"><div class="hero-editorial-copy"><p class="journal-kicker">' +
    esc(c.eyebrow || "YCH · OUR SCHOOL") +
    "</p><h1>" +
    esc(c.title) +
    '</h1><p class="hero-deck">' +
    esc(c.description) +
    "</p>" +
    actions +
    '<div class="hero-folio"><span>' +
    esc(c.tagline || "在趙小，一起學習，一起成長。") +
    '</span><span aria-hidden="true">↘</span></div></div>' +
    (photos.length
      ? '<div class="hero-photo-composition ' +
        (photos.length > 1 ? "multi-photo" : "") +
        '">' +
        photos
          .map(
            (p, i) =>
              '<figure class="editorial-cover">' +
              imageMarkup(p.src, p.alt || c.title, "", i === 0, p.rotation) +
              (p.caption
                ? "<figcaption>" + esc(p.caption) + "</figcaption>"
                : "") +
              "</figure>",
          )
          .join("") +
        "</div>"
      : "") +
    "</header>"
  );
}
function categoryIndexMarkup(c, children, content) {
  if (!children.length) return "";
  const portal = ["community", "admission"].includes(c.layout);
  return (
    '<nav class="container ' +
    (portal ? "portal-index" : "category-index") +
    '" aria-label="' +
    esc(c.title) +
    '子分類">' +
    children
      .map(
        (x, i) =>
          '<a href="' +
          categoryHref(x.id, content) +
          '">' +
          (portal && x.image
            ? '<div class="pathway-image">' +
              imageMarkup(
                x.image,
                x.imageAlt || x.title,
                "",
                false,
                x.imageRotation,
              ) +
              "</div>"
            : "") +
          '<div class="pathway-copy"><span class="pathway-number">' +
          String(i + 1).padStart(2, "0") +
          "</span><strong>" +
          esc(x.title) +
          "</strong>" +
          (portal ? "<p>" + esc(x.description) + "</p>" : "") +
          '<span class="pathway-arrow" aria-hidden="true">↗</span></div></a>',
      )
      .join("") +
    "</nav>"
  );
}

function renderCategoryPage(content) {
  if (!document.body.hasAttribute("data-category-page")) return;
  const id =
      new URLSearchParams(location.search).get("category") || "school-life",
    c = categoryById(content, id),
    root = document.querySelector("[data-page-content]");
  if (!c || !categoryVisible(content, id)) {
    root.innerHTML =
      '<div class="page-missing"><h1>找不到這個分類</h1><p>此分類尚未公開，或連結已更改。</p><a href="index.html">返回首頁 →</a></div>';
    return;
  }
  const redirect = categoryRedirectHref(id, location.search, content);
  if (redirect) {
    location.replace(redirect);
    return;
  }
  document.title = c.title + " | 仁濟醫院趙曾學韞小學";
  document.body.dataset.layout = c.layout;
  const children = childCategories(content, id),
    articles = categoryArticles(content, id),
    img = categoryImage(c, content);
  root.innerHTML =
    '<div class="container"><nav class="breadcrumbs" aria-label="頁面位置">' +
    trailMarkup(content, c) +
    "</nav>" +
    categoryHeroMarkup(c, children, content) +
    "</div>" +
    categoryIndexMarkup(c, children, content) +
    '<div class="container category-body"><div class="category-intro" data-category-blocks></div>' +
    (c.layout === "contact" ? contactMarkup(content) : "") +
    '<section class="collection-section" aria-label="分類內容"><div class="collection-heading"><div><p class="journal-kicker">' +
    (c.layout === "gallery"
      ? "PHOTO STORIES"
      : c.layout === "resources"
        ? "INFORMATION DESK"
        : "EXPLORE MORE") +
    "</p><h2>" +
    esc(
      c.collectionTitle ||
        (c.layout === "gallery"
          ? "相片裡的校園生活"
          : c.layout === "news"
            ? "消息與學習故事"
            : c.layout === "resources"
              ? "資料與文件"
              : "延伸閱讀"),
    ) +
    '</h2></div><p data-result-count aria-live="polite"></p></div><div class="collection-tools"><label><span class="sr-only">搜尋分類內容</span><input type="search" data-collection-search placeholder="搜尋標題或內容…"></label>' +
    (children.length
      ? '<label><span class="sr-only">篩選子分類</span><select data-collection-filter><option value="">全部分類</option>' +
        children
          .map(
            (x) =>
              '<option value="' + esc(x.id) + '">' + esc(x.title) + "</option>",
          )
          .join("") +
        "</select></label>"
      : "") +
    '</div><div data-collection-list></div><button class="load-more" type="button" data-load-more hidden>載入更多內容 ↓</button></section></div>';
  renderBlocks(
    c.blocks,
    root.querySelector("[data-category-blocks]"),
    "category-section",
  );
  let limit = 9;
  const search = root.querySelector("[data-collection-search]"),
    filter = root.querySelector("[data-collection-filter]"),
    list = root.querySelector("[data-collection-list]"),
    more = root.querySelector("[data-load-more]");
  const update = () => {
    const q = search.value.trim().toLocaleLowerCase(),
      ids = filter?.value ? descendantIds(content, filter.value) : null;
    const items = articles.filter(
      (a) =>
        (!ids || ids.has(a.categoryId)) &&
        (!q ||
          (a.title + " " + a.copy + " " + JSON.stringify(a.blocks))
            .toLocaleLowerCase()
            .includes(q)),
    );
    list.className =
      c.layout === "resources"
        ? "resource-collection"
        : c.layout === "gallery"
          ? "album-collection"
          : c.layout === "news"
            ? "news-collection"
            : "story-collection";
    list.innerHTML = items.length
      ? items
          .slice(0, limit)
          .map((a) =>
            cardMarkup(
              a,
              content,
              c.layout === "resources" ? "resource" : "story",
            ),
          )
          .join("")
      : '<div class="collection-empty"><h3>' +
        (q || ids ? "未找到符合條件的內容" : "最新資料將於此頁公布") +
        "</h3><p>" +
        esc(
          q || ids
            ? "試試其他關鍵字，或選擇全部分類。"
            : c.emptyMessage || "如需查詢現行安排，歡迎聯絡校務處。",
        ) +
        "</p>" +
        (q || ids
          ? ""
          : '<a href="category.html?category=contact-us">聯絡學校 →</a>') +
        "</div>";
    root.querySelector("[data-result-count]").textContent =
      items.length + " 項內容";
    more.hidden = items.length <= limit;
  };
  search.addEventListener("input", () => {
    limit = 9;
    update();
  });
  filter?.addEventListener("change", () => {
    limit = 9;
    update();
  });
  more.addEventListener("click", () => {
    limit += 9;
    update();
  });
  update();
  if (!articles.length && c.blocks.length && c.layout === "contact")
    root.querySelector(".collection-section").hidden = true;
}
function contactMarkup(content) {
  const c = content.contact || {};
  return (
    '<section class="contact-directory"><h2>與我們聯絡</h2><div><span>學校地址</span><p>' +
    esc(c.address) +
    '</p></div><div><span>校務處電話</span><a href="tel:' +
    esc(c.phone) +
    '">' +
    esc(c.phone) +
    '</a></div><div><span>電郵</span><a href="mailto:' +
    esc(c.email) +
    '">' +
    esc(c.email) +
    "</a></div><div><span>傳真</span><p>" +
    esc(c.fax) +
    "</p></div></section>"
  );
}
function applyArticleContent(content) {
  if (!document.body.hasAttribute("data-article-page")) return;
  const params = new URLSearchParams(location.search),
    preview = params.get("preview") === "1",
    a = (preview ? content.news.items : publishedArticles(content)).find(
      (x) => x.slug === params.get("slug"),
    ),
    root = document.querySelector("[data-page-content]");
  if (!a) {
    root.innerHTML =
      '<div class="page-missing"><h1>找不到這篇內容</h1><p>內容尚未公開，或連結已更改。</p><a href="index.html">返回首頁 →</a></div>';
    return;
  }
  const c = categoryById(content, a.categoryId),
    returnCategory = articleReturnCategory(content, a);
  document.title = a.title + " | 仁濟醫院趙曾學韞小學";
  const headings = a.blocks
    .map((b, i) =>
      b.heading
        ? '<a href="#article-section-' + i + '">' + esc(b.heading) + "</a>"
        : "",
    )
    .join("");
  root.innerHTML =
    '<div class="container"><nav class="breadcrumbs" aria-label="頁面位置">' +
    trailMarkup(content, returnCategory) +
    '<span aria-hidden="true">/</span><span>詳細內容</span></nav>' +
    (preview
      ? '<p class="preview-banner">內容預覽 · 尚未發布的修改只在此視窗顯示</p>'
      : "") +
    '<header class="story-header"><p class="journal-kicker">' +
    esc(articleCategoryLabel(a, content)) +
    (a.publishedAt ? " · " + esc(a.publishedAt) : "") +
    "</p><h1>" +
    esc(a.title) +
    '</h1><p class="story-standfirst">' +
    esc(a.copy) +
    "</p>" +
    (a.image
      ? '<figure class="story-cover ' +
        (a.format === "album" ? "album-cover" : "") +
        '">' +
        imageMarkup(a.image, a.imageAlt || a.title, "", true, a.imageRotation) +
        (a.imageCaption
          ? "<figcaption>" + esc(a.imageCaption) + "</figcaption>"
          : "") +
        "</figure>"
      : "") +
    '</header><div class="reading-layout"><aside class="reading-sidebar"><p class="journal-kicker">本頁內容</p><nav aria-label="文章目錄">' +
    (headings || '<a href="#article-content">閱讀內容</a>') +
    '</nav><a class="return-link" href="' +
    (returnCategory ? categoryHref(returnCategory.id, content) : "index.html") +
    '">← 返回' +
    esc(returnCategory?.title || "首頁") +
    '</a></aside><article id="article-content" class="rich-article" data-article-body></article></div><section class="related-section"><p class="journal-kicker">CONTINUE READING</p><h2>繼續探索趙小</h2><div class="story-collection" data-related></div></section></div>';
  renderBlocks(
    a.blocks,
    root.querySelector("[data-article-body]"),
    "article-section",
  );
  const related = categoryArticles(content, c?.parentId || a.categoryId)
    .filter((x) => x.slug !== a.slug)
    .slice(0, 3);
  root.querySelector("[data-related]").innerHTML = related
    .map((x) => cardMarkup(x, content))
    .join("");
  if (!related.length) root.querySelector(".related-section").hidden = true;
}
function applyTenderContent(content) {
  if (!document.querySelector("[data-tender-page]")) return;
  document.querySelectorAll("[data-tender-content]").forEach((e) => {
    e.textContent = getByPath(content, e.dataset.tenderContent) || "";
  });
  const list = document.querySelector("[data-tender-list]");
  if (list)
    list.innerHTML =
      categoryArticles(content, "tenders")
        .map((a) => cardMarkup(a, content, "resource"))
        .join("") || "<p>" + esc(content.tender?.content) + "</p>";
}
function setupPhotoViewer() {
  if (document.querySelector("[data-photo-viewer]")) return;
  const dialog = createElement("dialog", "photo-viewer");
  dialog.dataset.photoViewer = "";
  dialog.setAttribute("aria-label", "相片瀏覽");
  dialog.innerHTML =
    '<div class="photo-viewer-toolbar"><button type="button" data-photo-prev aria-label="上一張相片">← 上一張</button><button type="button" data-photo-next aria-label="下一張相片">下一張 →</button><button type="button" data-photo-close aria-label="關閉相片">關閉 ×</button></div><figure><img alt=""><figcaption></figcaption></figure>';
  document.body.append(dialog);
  let items = [],
    index = 0;
  const show = () => {
    const e = items[index];
    dialog.querySelector("figure").innerHTML =
      imageMarkup(
        e.dataset.photoSrc,
        e.dataset.photoCaption,
        "viewer-image",
        true,
        Number(e.dataset.photoRotation),
      ) + "<figcaption></figcaption>";
    dialog.querySelector("figcaption").textContent =
      index + 1 + " / " + items.length + " · " + e.dataset.photoCaption;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-photo-src]");
    if (!b) return;
    items = [...b.closest(".photo-grid").querySelectorAll("[data-photo-src]")];
    index = items.indexOf(b);
    show();
    dialog.showModal();
  });
  const move = (delta) => {
    index = (index + delta + items.length) % items.length;
    show();
  };
  dialog.querySelector("[data-photo-prev]").onclick = () => move(-1);
  dialog.querySelector("[data-photo-next]").onclick = () => move(1);
  dialog.querySelector("[data-photo-close]").onclick = () => dialog.close();
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") move(-1);
    if (e.key === "ArrowRight") move(1);
  });
}
function applyContent(content) {
  setupImageOrientations();
  const homeHero = document.querySelector("[data-home-hero]");
  if (homeHero && content.hero && Object.hasOwn(content.hero, "image"))
    homeHero.innerHTML = imageMarkup(
      content.hero.image,
      content.hero.imageAlt || content.hero.title,
      "hero-image",
      true,
      content.hero.imageRotation,
    );
  document.querySelectorAll("[data-content]").forEach((e) => {
    const v = getByPath(content, e.dataset.content);
    if (typeof v === "string") e.textContent = v;
  });
  document.querySelectorAll("[data-contact-phone]").forEach((e) => {
    e.href = "tel:" + (content.contact?.phone || "");
  });
  document.querySelectorAll("[data-contact-email]").forEach((e) => {
    e.href = "mailto:" + (content.contact?.email || "");
  });
  renderPrimaryNavigation(content);
  renderNews(content);
  renderCampus(content);
  renderCategoryPage(content);
  applyArticleContent(content);
  applyTenderContent(content);
  applyCategoryLinks(content);
  setupPhotoViewer();
}
