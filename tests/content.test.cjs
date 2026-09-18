const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  structuredClone,
  URLSearchParams,
  location: { search: "" },
  crypto: require("node:crypto").webcrypto,
});
vm.runInContext(
  fs.readFileSync(path.join(root, "content-manager.js"), "utf8"),
  context,
);
const call = (name, ...args) => vm.runInContext(name, context)(...args);
const content = call(
  "normalizeContent",
  JSON.parse(fs.readFileSync(path.join(root, "data/site-content.json"))),
);
test("transfer admission opens the article directly and returns to its parent", () => {
  const href = "article.html?slug=transfer-admission";
  assert.equal(call("categoryHref", "transfer-admission", content), href);
  assert.equal(
    call(
      "categoryRedirectHref",
      "transfer-admission",
      "?category=transfer-admission",
      content,
    ),
    href,
  );
  assert.equal(
    call(
      "categoryRedirectHref",
      "transfer-admission",
      "?category=transfer-admission&preview=1",
      content,
    ),
    href + "&preview=1",
  );
  assert.equal(call("categoryRedirectHref", "admission", "", content), "");
  const admission = content.categories.find((c) => c.id === "admission");
  const children = call("childCategories", content, "admission");
  for (const renderer of ["categoryHeroMarkup", "categoryIndexMarkup"]) {
    const html = call(renderer, admission, children, content);
    assert(html.includes(href));
    assert(!html.includes("category.html?category=transfer-admission"));
  }
  const article = content.news.items.find(
    (a) => a.slug === "transfer-admission",
  );
  assert.equal(call("articleReturnCategory", content, article).id, "admission");
});
test("all single-content entries skip introductions without losing content", () => {
  const direct = content.categories.filter((c) => c.entryMode === "auto");
  assert.equal(direct.length, 20);
  for (const c of direct) {
    const articles = call("categoryArticles", content, c.id);
    assert.equal(articles.length, 1, c.id);
    const href = "article.html?slug=" + articles[0].slug;
    assert.equal(call("categoryHref", c.id, content), href);
    assert.equal(
      call("resolveCategoryLink", "category.html?category=" + c.id, content),
      href,
    );
    assert.equal(
      call("categoryRedirectHref", c.id, "?preview=1", content),
      href + "&preview=1",
    );
    const back = call("articleReturnCategory", content, articles[0]);
    assert(
      !back || call("categoryHref", back.id, content) !== href,
      c.id + " back-link loop",
    );
  }
});
test("publishing a second article restores its category; drafts stay out of the way", () => {
  const data = structuredClone(content);
  const existing = data.news.items.find((a) => a.slug === "transfer-admission");
  const next = {
    ...existing,
    slug: "another-transfer",
    title: "另一篇入學消息",
    status: "draft",
  };
  data.news.items.push(next);
  const original = "category.html?category=transfer-admission";
  assert.equal(
    call("categoryHref", existing.categoryId, data),
    "article.html?slug=transfer-admission",
  );
  next.status = "published";
  assert.equal(call("categoryHref", existing.categoryId, data), original);
  assert.equal(call("resolveCategoryLink", original, data), original);
  assert.equal(call("categoryRedirectHref", existing.categoryId, "", data), "");
  assert.equal(
    call("articleReturnCategory", data, existing).id,
    existing.categoryId,
  );
});
test("empty placeholders are hidden but recoverable; genuine hubs remain", () => {
  const hidden = content.categories.filter((c) => !c.visible);
  assert.equal(hidden.length, 14);
  for (const c of hidden) {
    assert.equal(call("categoryArticles", content, c.id).length, 0);
    assert.equal(
      call("resolveCategoryLink", "category.html?category=" + c.id, content),
      null,
    );
    assert.equal(call("categoryRedirectHref", c.id, "", content), "");
  }
  for (const id of [
    "school-information",
    "school-life",
    "ych-family",
    "admission",
    "learning-teaching",
    "subjects",
    "parent-teacher-association",
    "activity-photos",
    "latest-news",
    "contact-us",
  ]) {
    assert.equal(
      call("categoryHref", id, content),
      "category.html?category=" + id,
    );
  }
  const ncs = content.news.items.find(
    (a) => a.slug === "ncs-cultural-inclusion",
  );
  assert.equal(call("articleReturnCategory", content, ncs), undefined);
  assert.equal(
    call("resolveCategoryLink", "https://example.org/", content),
    "https://example.org/",
  );
});
test("published collections include descendants and hide drafts / hidden ancestors", () => {
  const data = structuredClone(content);
  const item = data.news.items.find((a) => a.categoryId === "english");
  assert(
    call("categoryArticles", data, "learning-teaching").some(
      (a) => a.slug === item.slug,
    ),
  );
  item.status = "draft";
  assert(!call("publishedArticles", data).some((a) => a.slug === item.slug));
  item.status = "published";
  data.categories.find((c) => c.id === "subjects").visible = false;
  assert(!call("publishedArticles", data).some((a) => a.slug === item.slug));
});
test("pinning then publication date; stable manual order for undated stories", () => {
  const data = structuredClone(content);
  data.news.items = [
    {
      slug: "a",
      categoryId: "latest-news",
      title: "A",
      status: "published",
      publishedAt: "2026-09-01",
      blocks: [],
    },
    {
      slug: "b",
      categoryId: "latest-news",
      title: "B",
      status: "published",
      publishedAt: "2026-09-02",
      blocks: [],
    },
    {
      slug: "c",
      categoryId: "latest-news",
      title: "C",
      status: "published",
      pinned: true,
      blocks: [],
    },
  ];
  assert.equal(
    call("categoryArticles", data, "latest-news")
      .map((a) => a.slug)
      .join(","),
    "c,b,a",
  );
});
test("legacy articles migrate without dropping rich media or extra fields", () => {
  const data = call("normalizeContent", {
    categories: [],
    news: {
      items: [
        { slug: "a", content: "標題\n內文\n\n第二段", extra: "preserve" },
      ],
    },
  });
  assert.equal(data.news.items[0].blocks.length, 2);
  assert.equal(data.news.items[0].extra, "preserve");
  assert.equal(
    call("normalizeContent", content).news.items.find(
      (a) => a.slug === "english-album",
    ).blocks[1].images.length,
    17,
  );
});
test("untrusted URL and HTML strings cannot become executable markup", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//evil.test",
    "java\nscript:alert(1)",
    "\\evil.test",
  ])
    assert.equal(call("safeURL", url), "");
  assert.equal(
    call("safeURL", "assets/documents/school-calendar.pdf"),
    "assets/documents/school-calendar.pdf",
  );
  assert.equal(
    call("esc", '<img onerror="alert(1)">'),
    "&lt;img onerror=&quot;alert(1)&quot;&gt;",
  );
});
test("every local asset and internal article/category reference resolves", () => {
  const categories = new Set(content.categories.map((c) => c.id)),
    articles = new Set(content.news.items.map((a) => a.slug));
  const inspect = (value) => {
    if (typeof value === "string") {
      if (value.startsWith("assets/"))
        assert(fs.existsSync(path.join(root, value)), value);
      if (value.startsWith("article.html?"))
        assert(
          articles.has(new URLSearchParams(value.split("?")[1]).get("slug")),
          value,
        );
      if (value.startsWith("category.html?"))
        assert(
          categories.has(
            new URLSearchParams(value.split("?")[1]).get("category"),
          ),
          value,
        );
    } else if (value && typeof value === "object")
      Object.values(value).forEach(inspect);
  };
  inspect(content);
  assert.equal(categories.size, content.categories.length);
  assert.equal(articles.size, content.news.items.length);
});
test("all seven category layouts and multiple genuine image albums are present", () => {
  assert.equal(new Set(content.categories.map((c) => c.layout)).size, 7);
  assert(
    content.news.items.filter(
      (a) =>
        a.format === "album" &&
        a.blocks.some((b) => b.type === "gallery" && b.images.length > 2),
    ).length >= 5,
  );
});

test("Word image rotations apply to gallery, cover and legacy references without rewriting photos", () => {
  for (const n of [2, 11]) {
    const src = `assets/imported/english/image${n}.jpeg`;
    assert.equal(call("imageRotation", src), 90);
    assert.match(
      call("imageMarkup", src, "school photo"),
      /data-rotation="90"/,
    );
    assert.equal(call("imageRotation", src, 0), 0);
    assert.equal(call("imageRotation", src, 270), 270);
    const album = content.news.items.find((a) => a.slug === "english-album");
    assert.equal(
      album.blocks
        .find((b) => b.type === "gallery")
        .images.find((p) => p.src === src).rotation,
      90,
    );
  }
  assert.equal(call("imageRotation", "photo.jpg", "90;bad"), 0);
  assert.equal(
    call("rotationPath", "categories.0.image"),
    "categories.0.imageRotation",
  );
  assert.equal(
    call("rotationPath", "news.items.0.blocks.0.images.1.src"),
    "news.items.0.blocks.0.images.1.rotation",
  );
});

test("portals use editable photos, no repeated home hero or inherited surprise cover", () => {
  const home = content.hero.image;
  assert(content.categories.every((c) => c.image !== home));
  for (const id of ["ych-family", "admission"]) {
    const category = content.categories.find((c) => c.id === id);
    assert(category.heroImages.length > 0);
    assert(
      category.blocks.some((b) => b.type === "feature" && b.src && b.text),
    );
    const html = call(
      "categoryHeroMarkup",
      category,
      call("childCategories", content, id),
    );
    assert.match(html, /hero-photo-composition/);
    assert(html.includes(category.heroImages[0].src));
    assert(!html.includes(home));
  }
  assert.equal(
    call("categoryImage", { image: "", parentId: "ych-family" }, content),
    "",
  );
});
