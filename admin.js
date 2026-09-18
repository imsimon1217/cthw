let currentContent,
  selectedCategory = "school-life",
  selectedArticle = "",
  serverMode = false,
  serverAvailable = false,
  dirty = false,
  uploading = 0,
  previousRemoval = null,
  settingsMode = false;
const workspace = document.querySelector("[data-workspace]");
const toast = document.querySelector("[data-toast]");
let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 6000);
}
function setDirty() {
  dirty = true;
  document.querySelector("[data-save-state]").textContent = "有未儲存的修改";
}
function setPath(path, value) {
  const keys = path.split("."),
    last = keys.pop();
  const target = keys.reduce((v, k) => v[k], currentContent);
  if (last === "slug" && target.slug === selectedArticle)
    selectedArticle = value;
  target[last] = value;
}
function field(label, path, type = "text", options = null) {
  const v = getByPath(currentContent, path) ?? "";
  if (type === "checkbox")
    return (
      '<label class="check-field"><input type="checkbox" data-bind="' +
      path +
      '"' +
      (v ? " checked" : "") +
      ">" +
      esc(label) +
      "</label>"
    );
  const input =
    type === "textarea"
      ? '<textarea rows="4" data-bind="' + path + '">' + esc(v) + "</textarea>"
      : type === "select"
        ? '<select data-bind="' +
          path +
          '">' +
          Object.entries(options)
            .map(
              ([key, val]) =>
                '<option value="' +
                esc(key) +
                '"' +
                (v === key ? " selected" : "") +
                ">" +
                esc(val) +
                "</option>",
            )
            .join("") +
          "</select>"
        : '<input type="' +
          type +
          '" data-bind="' +
          path +
          '" value="' +
          esc(v) +
          '">';
  return "<label>" + esc(label) + input + "</label>";
}
function assetField(path, label = "圖片", captionPath = "") {
  const src = getByPath(currentContent, path),
    rp = rotationPath(path);
  if (getByPath(currentContent, rp) === undefined)
    setPath(rp, imageRotation(src));
  const angle = getByPath(currentContent, rp);
  return (
    '<div class="asset-field">' +
    (src
      ? imageMarkup(src, label, "asset-preview", false, angle)
      : '<div class="asset-placeholder">尚未選擇圖片</div>') +
    "<div><label>" +
    esc(label) +
    '<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="' +
    path +
    '"></label><details><summary>圖片網址／路徑</summary>' +
    field("圖片來源", path) +
    "</details>" +
    (captionPath ? field("圖片說明", captionPath) : "") +
    '<label>圖片方向<select data-rotation-bind="' +
    rp +
    '">' +
    [0, 90, 180, 270]
      .map(
        (n) =>
          '<option value="' +
          n +
          '"' +
          (Number(angle) === n ? " selected" : "") +
          ">" +
          {
            0: "原來方向",
            90: "順時針 90°",
            180: "旋轉 180°",
            270: "逆時針 90°",
          }[n] +
          "</option>",
      )
      .join("") +
    "</select></label>" +
    '<button type="button" class="small-button" data-clear-image="' +
    path +
    '">移除圖片</button></div></div>'
  );
}
function controls(path, index, length, kind = "內容區塊") {
  return (
    '<div class="row-controls"><button type="button" class="small-button" data-move="' +
    path +
    '" data-index="' +
    index +
    '" data-direction="-1" aria-label="上移' +
    kind +
    '"' +
    (index === 0 ? " disabled" : "") +
    '>↑</button><button type="button" class="small-button" data-move="' +
    path +
    '" data-index="' +
    index +
    '" data-direction="1" aria-label="下移' +
    kind +
    '"' +
    (index === length - 1 ? " disabled" : "") +
    '>↓</button><button type="button" class="small-button danger" data-remove="' +
    path +
    '" data-index="' +
    index +
    '">移除' +
    kind +
    "</button></div>"
  );
}
function blocksEditor(blocks, path) {
  return (
    '<div class="blocks-editor">' +
    blocks
      .map((b, i) => {
        const p = path + "." + i;
        let body = field("段落標題（可留空）", p + ".heading");
        if (
          [
            "text",
            "callout",
            "gallery",
            "image",
            "feature",
            "list",
            "steps",
            "links",
          ].includes(b.type)
        )
          body += field("文字內容", p + ".text", "textarea");
        if (b.type === "image" || b.type === "feature")
          body +=
            assetField(p + ".src", "上載圖片", p + ".caption") +
            field("替代文字（圖片的內容描述）", p + ".alt");
        if (b.type === "feature")
          body +=
            field("按鈕文字", p + ".label") + field("按鈕連結", p + ".href");
        if (b.type === "gallery")
          body +=
            '<div class="gallery-editor">' +
            (b.images || [])
              .map(
                (im, j) =>
                  '<div class="gallery-edit-item">' +
                  assetField(
                    p + ".images." + j + ".src",
                    "更換相片",
                    p + ".images." + j + ".caption",
                  ) +
                  field("替代文字", p + ".images." + j + ".alt") +
                  controls(p + ".images", j, b.images.length, "相片") +
                  "</div>",
              )
              .join("") +
            '</div><label class="upload-zone">＋ 一次上載多張相片<input type="file" multiple accept="image/jpeg,image/png,image/webp" data-gallery-upload="' +
            p +
            '.images"></label><button type="button" class="outline" data-add-image="' +
            p +
            '.images">＋ 以圖片網址加入</button>';
        if (["list", "steps", "faq"].includes(b.type))
          body +=
            (b.items || [])
              .map(
                (x, j) =>
                  '<div class="line-editor">' +
                  field(
                    b.type === "faq"
                      ? "第一行填問題，下一行填答案"
                      : "內容 " + (j + 1),
                    p + ".items." + j,
                    "textarea",
                  ) +
                  controls(p + ".items", j, b.items.length, "項目") +
                  "</div>",
              )
              .join("") +
            '<button type="button" class="outline" data-add-line="' +
            p +
            '.items">＋ 新增一項</button>';
        if (b.type === "links")
          body +=
            (b.links || [])
              .map(
                (l, j) =>
                  '<div class="line-editor">' +
                  field("文件／連結名稱", p + ".links." + j + ".label") +
                  field("連結網址", p + ".links." + j + ".href") +
                  field("補充說明", p + ".links." + j + ".description") +
                  '<label>上載 PDF 文件<input type="file" accept="application/pdf" data-document-upload="' +
                  p +
                  ".links." +
                  j +
                  '.href"></label>' +
                  controls(p + ".links", j, b.links.length, "連結") +
                  "</div>",
              )
              .join("") +
            '<button type="button" class="outline" data-add-link="' +
            p +
            '.links">＋ 新增文件／連結</button>';
        return (
          '<details class="block-editor" open><summary><span>' +
          String(i + 1).padStart(2, "0") +
          " · " +
          esc(BLOCK_TYPES[b.type] || "文字段落") +
          '</span><span>收合／展開</span></summary><div class="block-editor-body">' +
          controls(path, i, blocks.length) +
          body +
          "</div></details>"
        );
      })
      .join("") +
    '<div class="add-block-bar"><label>加入內容區塊<select data-block-type="' +
    path +
    '">' +
    Object.entries(BLOCK_TYPES)
      .map(([k, v]) => '<option value="' + k + '">' + v + "</option>")
      .join("") +
    '</select></label><button type="button" data-add-block="' +
    path +
    '">＋ 加入區塊</button></div></div>'
  );
}
function categoryChoices() {
  return Object.fromEntries(
    currentContent.categories.map((c) => [
      c.id,
      (c.parentId ? "— " : "") + c.title,
    ]),
  );
}
function renderTree() {
  const visit = (parent, depth = 0, seen = new Set()) =>
    currentContent.categories
      .filter((c) => c.parentId === parent && !seen.has(c.id))
      .map((c) => {
        const next = new Set(seen).add(c.id);
        const count = currentContent.news.items.filter(
          (a) => a.categoryId === c.id,
        ).length;
        return (
          '<button type="button" class="tree-item ' +
          (!settingsMode && selectedCategory === c.id ? "selected" : "") +
          '" style="--depth:' +
          depth +
          '" data-category="' +
          esc(c.id) +
          '"' +
          (selectedCategory === c.id ? ' aria-current="page"' : "") +
          "><span>" +
          esc(c.title) +
          (c.visible ? "" : " · 隱藏") +
          "</span><small>" +
          count +
          "</small></button>" +
          visit(c.id, depth + 1, next)
        );
      })
      .join("");
  document.querySelector("[data-category-tree]").innerHTML = visit("");
}
function renderWorkspace() {
  renderTree();
  const c = categoryById(currentContent, selectedCategory);
  document.querySelector("[data-workspace-title]").textContent = settingsMode
    ? "首頁及聯絡設定"
    : c?.title || "內容工作室";
  if (settingsMode) {
    renderSettings();
    return;
  }
  c.heroImages ||= [];
  const index = currentContent.categories.indexOf(c),
    p = "categories." + index;
  const descendants = descendantIds(currentContent, c.id);
  const items = currentContent.news.items.filter((a) =>
    descendants.has(a.categoryId),
  );
  workspace.innerHTML =
    '<details class="studio-panel category-settings"><summary><strong>分類版面與介紹</strong><span>' +
    esc(LAYOUTS[c.layout]) +
    ' · 按此編輯</span></summary><div class="panel-body"><div class="field-grid">' +
    field("分類名稱", p + ".title") +
    field("前台顯示方式", p + ".layout", "select", LAYOUTS) +
    field("分類入口", p + ".entryMode", "select", {
      auto: "只有一篇時直接開全文／相簿；多篇顯示列表",
      page: "保留完整分類導覽頁",
    }) +
    field("上層分類", p + ".parentId", "select", {
      "": "主分類",
      ...Object.fromEntries(
        currentContent.categories
          .filter((x) => !descendants.has(x.id))
          .map((x) => [x.id, x.title]),
      ),
    }) +
    field("英文副標", p + ".eyebrow") +
    "</div>" +
    field("分類介紹", p + ".description", "textarea") +
    field("頁尾短句", p + ".tagline") +
    field("內容清單標題", p + ".collectionTitle") +
    assetField(p + ".image", "分類封面", p + ".imageCaption") +
    field("圖片替代文字", p + ".imageAlt") +
    '<details class="hero-image-editor"><summary>標題區附加圖片（可新增多張）</summary><p class="hint">與分類封面一起組成標題區。每張都可更換、旋轉及排序。</p>' +
    c.heroImages
      .map(
        (im, i) =>
          '<div class="gallery-edit-item">' +
          assetField(
            p + ".heroImages." + i + ".src",
            "標題區相片",
            p + ".heroImages." + i + ".caption",
          ) +
          field("替代文字", p + ".heroImages." + i + ".alt") +
          controls(p + ".heroImages", i, c.heroImages.length, "標題區相片") +
          "</div>",
      )
      .join("") +
    '<label class="upload-zone">＋ 上載標題區相片<input type="file" multiple accept="image/jpeg,image/png,image/webp" data-gallery-upload="' +
    p +
    '.heroImages"></label><button type="button" class="outline" data-add-image="' +
    p +
    '.heroImages">＋ 以圖片網址加入</button></details>' +
    field("在網站顯示此分類", p + ".visible", "checkbox") +
    '<h3>分類頁內容</h3><p class="hint">選擇直接開全文時，請在下方「文章與相簿」編輯訪客看到的內容。只有一篇已發布內容時會略過這裡的分類介紹；新增第二篇已發布內容後，自動顯示分類頁及列表。分類介紹和圖片仍會保留。</p>' +
    blocksEditor(c.blocks, p + ".blocks") +
    "</div></details>" +
    '<section class="studio-panel"><div class="panel-heading"><div><h2>文章與相簿</h2><p>' +
    items.length +
    ' 項內容 · 包括子分類</p></div><div class="studio-actions"><button type="button" data-new-article="story">＋ 新增文章</button><button type="button" class="outline" data-new-article="album">＋ 新增相簿</button></div></div><label class="content-search">搜尋內容<input type="search" data-admin-search placeholder="輸入標題搜尋"></label><div class="content-table">' +
    items
      .map((a) => {
        const ai = currentContent.news.items.indexOf(a);
        return (
          '<div class="content-row" data-row-title="' +
          esc(a.title.toLocaleLowerCase()) +
          '">' +
          (a.image
            ? imageMarkup(a.image, "", "row-thumbnail", false, a.imageRotation)
            : '<span class="row-type">' +
              (a.format === "album" ? "相簿" : "文章") +
              "</span>") +
          '<button type="button" class="article-select" data-edit-article="' +
          esc(a.slug) +
          '"><strong>' +
          esc(a.title) +
          "</strong><small>" +
          esc(categoryById(currentContent, a.categoryId)?.title) +
          " · " +
          (a.status === "draft" ? "草稿" : "已發布") +
          (a.pinned ? " · 置頂" : "") +
          '</small></button><div class="row-controls"><button type="button" class="small-button" data-move="news.items" data-index="' +
          ai +
          '" data-direction="-1" aria-label="上移文章">↑</button><button type="button" class="small-button" data-move="news.items" data-index="' +
          ai +
          '" data-direction="1" aria-label="下移文章">↓</button></div></div>'
        );
      })
      .join("") +
    (items.length
      ? ""
      : '<p class="empty-hint">此分類尚未有內容。新增文章或相簿後，會自動出現在對應前台分類。</p>') +
    "</div></section><div data-article-editor></div>";
  renderArticleEditor();
}
function renderArticleEditor() {
  const root = workspace.querySelector("[data-article-editor]");
  if (!root) return;
  const index = currentContent.news.items.findIndex(
    (a) => a.slug === selectedArticle,
  );
  if (index < 0) {
    root.replaceChildren();
    return;
  }
  const a = currentContent.news.items[index],
    p = "news.items." + index;
  root.innerHTML =
    '<section class="studio-panel article-edit-panel"><div class="panel-heading"><div><p class="kicker">正在編輯</p><h2>' +
    esc(a.title) +
    '</h2></div><button type="button" class="outline" data-close-article>收起編輯器</button></div><div class="panel-body">' +
    field("文章標題", p + ".title") +
    '<div class="field-grid">' +
    field("所屬分類", p + ".categoryId", "select", categoryChoices()) +
    field("內容類型", p + ".format", "select", {
      story: "文章／消息",
      album: "多圖相簿",
      resource: "文件／通告",
    }) +
    field("發布狀態", p + ".status", "select", {
      draft: "草稿（前台不顯示）",
      published: "已發布",
    }) +
    field("發布日期（可留空，填寫後按日期倒序）", p + ".publishedAt", "date") +
    "</div>" +
    field("摘要（顯示在內容清單）", p + ".copy", "textarea") +
    assetField(p + ".image", "文章封面", p + ".imageCaption") +
    field("封面替代文字", p + ".imageAlt") +
    '<div class="check-row">' +
    field("置頂", p + ".pinned", "checkbox") +
    field("同時顯示於首頁", p + ".showOnHome", "checkbox") +
    '</div><h3>詳細內容</h3><p class="hint">可加入任意數量的文字、相片、相簿及文件，並用箭嘴排序。</p>' +
    blocksEditor(a.blocks, p + ".blocks") +
    '<details class="advanced"><summary>網址及進階設定</summary>' +
    field("網址代號（更改會影響舊連結）", p + ".slug") +
    field("指定外部連結（留空會開啟詳細內容）", p + ".linkHref") +
    '</details><div class="editor-bottom"><button type="button" data-preview-article>預覽這篇內容 ↗</button><button type="button" class="outline danger" data-remove="news.items" data-index="' +
    index +
    '">移除文章</button></div></div></section>';
}
function renderSettings() {
  const groups = [
    [
      "首頁主視覺",
      ["hero.eyebrow", "英文副標"],
      ["hero.title", "主標題"],
      ["hero.copy", "首頁簡介"],
    ],
    [
      "關於趙小",
      ["about.heading", "標題"],
      ["about.paragraph1", "段落一"],
      ["about.paragraph2", "段落二"],
    ],
    ["首頁消息", ["news.heading", "區塊標題"]],
    ["入學資訊", ["admission.heading", "標題"], ["admission.copy", "內容"]],
    [
      "聯絡資料",
      ["contact.heading", "標題"],
      ["contact.copy", "介紹"],
      ["contact.address", "地址"],
      ["contact.phone", "電話"],
      ["contact.fax", "傳真"],
      ["contact.email", "電郵"],
    ],
  ];
  workspace.innerHTML =
    groups
      .map(
        ([title, ...fields]) =>
          '<section class="studio-panel panel-body"><h2>' +
          title +
          "</h2>" +
          fields
            .map(([p, l]) =>
              field(l, p, /copy|paragraph/.test(p) ? "textarea" : "text"),
            )
            .join("") +
          (title === "首頁主視覺"
            ? assetField("hero.image", "首頁大圖", "hero.imageCaption") +
              field("圖片替代文字", "hero.imageAlt")
            : "") +
          "</section>",
      )
      .join("") +
    '<section class="studio-panel panel-body"><h2>首頁校園相片</h2>' +
    field("標題", "campus.heading") +
    field("介紹", "campus.copy", "textarea") +
    currentContent.campus.images
      .map(
        (im, i) =>
          '<div class="gallery-edit-item">' +
          assetField("campus.images." + i + ".src", "校園相片") +
          field("相片標題", "campus.images." + i + ".title") +
          field("替代文字", "campus.images." + i + ".alt") +
          controls(
            "campus.images",
            i,
            currentContent.campus.images.length,
            "相片",
          ) +
          "</div>",
      )
      .join("") +
    '<button type="button" class="outline" data-add-campus>＋ 新增校園相片</button></section><section class="studio-panel panel-body"><h2>內容備份</h2><p>下載的檔案包含全部分類、文章及相簿資料。正式伺服器的相片檔案亦應由學校 IT 一併備份。</p><button type="button" class="outline" data-export>下載內容備份</button><label>匯入內容備份<input type="file" accept=".json,application/json" data-import></label></section>';
}
function showDashboard() {
  document.querySelector("[data-login-panel]").hidden = true;
  document.querySelector("[data-dashboard]").hidden = false;
  document.body.classList.add("is-authenticated");
}
async function initDashboard() {
  currentContent = await loadSiteContent();
  currentContent.schemaVersion = 2;
  currentContent.hero.image ??= "assets/official-students-hero-2400.jpg";
  setupImageOrientations();
  currentContent.campus ||= { images: [] };
  currentContent.campus.images ||= [];
  if (!categoryById(currentContent, selectedCategory))
    selectedCategory = currentContent.categories[0]?.id;
  showDashboard();
  document.querySelector("[data-mode-notice]").textContent = serverMode
    ? "已連接學校伺服器。儲存後，所有訪客都會看到已發布內容。"
    : "本機／靜態示範：修改會保存在此瀏覽器。正式學校網站透過 PHP 後台儲存，所有訪客均可看到更新。";
  renderWorkspace();
}
async function apiPost(path, payload) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "未能完成操作");
  return d;
}
function validateContentForSave(d) {
  if (!Array.isArray(d.categories) || !Array.isArray(d.news?.items))
    throw Error("內容格式不正確");
  const ids = new Set(),
    slugs = new Set();
  for (const c of d.categories) {
    if (!c.id || !c.title.trim() || ids.has(c.id))
      throw Error("分類名稱不可空白，識別碼不可重複");
    ids.add(c.id);
  }
  for (const c of d.categories) {
    const seen = new Set([c.id]);
    let p = c.parentId;
    while (p) {
      if (!ids.has(p) || seen.has(p)) throw Error("分類的上下層關係不正確");
      seen.add(p);
      p = d.categories.find((x) => x.id === p).parentId;
    }
    if (!LAYOUTS[c.layout]) throw Error("請選擇分類版面");
    validateBlocks(c.blocks);
    for (const photo of c.heroImages || [])
      if (!safeURL(photo.src, true))
        throw Error("標題區有相片未選擇圖片，請上載相片或移除空白項目");
  }
  for (const a of d.news.items) {
    if (!ids.has(a.categoryId)) throw Error("文章所屬分類不存在");
    if (!a.title.trim() || !a.slug || slugs.has(a.slug))
      throw Error("文章需要標題及不重複的網址代號");
    slugs.add(a.slug);
    if (a.status === "published" && !a.blocks.length && !a.linkHref)
      throw Error("已發布文章需要詳細內容");
    validateBlocks(a.blocks);
    if (a.linkHref && !safeURL(a.linkHref)) throw Error("文章連結無效");
  }
}
function validateBlocks(blocks) {
  if (!Array.isArray(blocks)) throw Error("內容段落格式不正確");
  for (const b of blocks) {
    if (!BLOCK_TYPES[b.type]) throw Error("段落類型不支援");
    if (b.type === "links")
      for (const l of b.links || [])
        if (!l.label.trim() || !safeURL(l.href))
          throw Error("文件連結需要名稱及有效網址");
    if (["image", "feature"].includes(b.type) && b.src && !safeURL(b.src, true))
      throw Error("圖片網址無效");
    if (b.type === "feature" && b.href && !safeURL(b.href))
      throw Error("圖文專題連結無效");
    if (b.type === "gallery")
      for (const p of b.images || [])
        if (!safeURL(p.src, true)) throw Error("相簿內有相片未選擇圖片");
  }
}
async function saveContent() {
  if (uploading) {
    showToast("圖片或文件仍在上載，完成後再儲存。");
    return;
  }
  const button = document.querySelector("[data-save]");
  button.disabled = true;
  try {
    validateContentForSave(currentContent);
    currentContent.schemaVersion = 2;
    if (serverMode)
      await apiPost("api/save-content.php", { content: currentContent });
    else await saveStoredContent(currentContent);
    dirty = false;
    document.querySelector("[data-save-state]").textContent =
      "已儲存 · " + new Date().toLocaleTimeString("zh-HK");
    showToast(
      serverMode ? "所有修改已儲存至學校網站。" : "所有修改已儲存至本機預覽。",
    );
    renderWorkspace();
  } catch (e) {
    showToast(e.message);
  } finally {
    button.disabled = false;
  }
}
function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const im = new Image(),
      url = URL.createObjectURL(file);
    im.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1600 / Math.max(im.width, im.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(im.width * scale);
      canvas.height = Math.round(im.height * scale);
      canvas.getContext("2d").drawImage(im, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("圖片未能讀取"));
    };
    im.src = url;
  });
}
async function uploadFile(file, documentFile = false) {
  if (file.size > 6 * 1024 * 1024) throw Error("每個檔案請少於 6 MB");
  if (
    !documentFile &&
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw Error("請使用 JPG、PNG 或 WebP 圖片");
  if (!serverMode) {
    if (documentFile)
      throw Error(
        "本機靜態預覽請使用文件網址；正式 PHP 伺服器可直接上載 PDF。",
      );
    return imageToDataUrl(file);
  }
  const form = new FormData();
  form.append(documentFile ? "document" : "image", file);
  const r = await fetch(
      documentFile ? "api/upload-document.php" : "api/upload-image.php",
      { method: "POST", credentials: "same-origin", body: form },
    ),
    d = await r.json();
  if (!r.ok) throw Error(d.error || "上載失敗，請重新登入後再試");
  return d.src;
}
function newBlock(type) {
  return {
    type,
    heading: "",
    text: "",
    ...(type === "gallery" ? { images: [] } : {}),
    ...(["list", "steps", "faq"].includes(type) ? { items: [""] } : {}),
    ...(type === "links" ? { links: [] } : {}),
    ...(["image", "feature"].includes(type)
      ? {
          src: "",
          caption: "",
          alt: "",
          ...(type === "feature" ? { href: "", label: "了解更多" } : {}),
        }
      : {}),
  };
}
function preview(article = false) {
  try {
    sessionStorage.setItem(
      "ych-content-preview",
      JSON.stringify(currentContent),
    );
    const url =
      article || selectedArticle
        ? "article.html?slug=" +
          encodeURIComponent(selectedArticle) +
          "&preview=1"
        : categoryHref(selectedCategory, currentContent) + "&preview=1";
    window.open(settingsMode ? "index.html?preview=1" : url, "_blank");
  } catch {
    showToast("預覽資料過大，請先儲存，再直接打開網站預覽。");
  }
}
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.bind) {
    setPath(el.dataset.bind, el.type === "checkbox" ? el.checked : el.value);
    setDirty();
  }
  if (el.matches("[data-admin-search]"))
    workspace.querySelectorAll("[data-row-title]").forEach((row) => {
      row.hidden = !row.dataset.rowTitle.includes(el.value.toLocaleLowerCase());
    });
});
document.addEventListener("change", async (e) => {
  const el = e.target;
  if (el.dataset.rotationBind) {
    setPath(el.dataset.rotationBind, imageRotation("", el.value));
    setDirty();
    refreshEditor();
    return;
  }
  if (el.dataset.bind) {
    setPath(el.dataset.bind, el.type === "checkbox" ? el.checked : el.value);
    setDirty();
  }
  if (el.matches("[data-import]") && el.files[0]) {
    try {
      const next = normalizeContent(JSON.parse(await el.files[0].text()));
      validateContentForSave(next);
      if (!confirm("匯入備份會取代目前未儲存的編輯，是否繼續？")) return;
      currentContent = next;
      setDirty();
      selectedArticle = "";
      selectedCategory = next.categories[0].id;
      renderWorkspace();
    } catch (err) {
      showToast(err.message);
    }
    return;
  }
  const path =
    el.dataset.upload || el.dataset.galleryUpload || el.dataset.documentUpload;
  if (!path || !el.files?.length) return;
  uploading++;
  document.querySelector("[data-save]").disabled = true;
  try {
    let count = 0;
    for (const file of el.files) {
      showToast("正在處理檔案 " + ++count + " / " + el.files.length);
      const src = await uploadFile(file, !!el.dataset.documentUpload);
      if (el.dataset.galleryUpload)
        getByPath(currentContent, path).push({ src, alt: "", caption: "" });
      else {
        setPath(path, src);
        if (!el.dataset.documentUpload) setPath(rotationPath(path), 0);
      }
      setDirty();
    }
    showToast("檔案已加入，請儲存修改。");
  } catch (err) {
    showToast(err.message);
  } finally {
    uploading--;
    document.querySelector("[data-save]").disabled = uploading > 0;
    refreshEditor();
  }
});
function refreshEditor() {
  const open = workspace.querySelector(".category-settings")?.open;
  renderWorkspace();
  if (open && workspace.querySelector(".category-settings"))
    workspace.querySelector(".category-settings").open = true;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (uploading && !b.matches("[data-close-help]")) {
    showToast("請等檔案上載完成。");
    return;
  }
  if (b.dataset.category) {
    selectedCategory = b.dataset.category;
    selectedArticle = "";
    settingsMode = false;
    renderWorkspace();
    window.scrollTo(0, 0);
  }
  if (b.hasAttribute("data-settings")) {
    settingsMode = true;
    selectedArticle = "";
    renderWorkspace();
  }
  if (b.hasAttribute("data-add-category")) {
    const c = {
      id: uid("category"),
      title: "新分類",
      parentId: selectedCategory || "",
      description: "",
      image: "",
      visible: false,
      entryMode: "auto",
      layout: "editorial",
      blocks: [],
    };
    currentContent.categories.push(c);
    selectedCategory = c.id;
    selectedArticle = "";
    settingsMode = false;
    setDirty();
    renderWorkspace();
    workspace.querySelector(".category-settings").open = true;
  }
  if (b.dataset.newArticle) {
    const a = {
      slug: uid("article"),
      categoryId: selectedCategory,
      title: b.dataset.newArticle === "album" ? "新相簿" : "新文章",
      copy: "",
      image: "",
      status: "draft",
      format: b.dataset.newArticle,
      showOnHome: false,
      pinned: false,
      blocks: [newBlock(b.dataset.newArticle === "album" ? "gallery" : "text")],
    };
    currentContent.news.items.unshift(a);
    selectedArticle = a.slug;
    setDirty();
    renderWorkspace();
    workspace
      .querySelector("[data-article-editor]")
      .scrollIntoView({ block: "start" });
  }
  if (b.dataset.editArticle) {
    selectedArticle = b.dataset.editArticle;
    renderArticleEditor();
    workspace
      .querySelector("[data-article-editor]")
      .scrollIntoView({ block: "start" });
  }
  if (b.hasAttribute("data-close-article")) {
    selectedArticle = "";
    renderArticleEditor();
  }
  if (b.dataset.addBlock) {
    const p = b.dataset.addBlock,
      type = workspace.querySelector('[data-block-type="' + p + '"]').value;
    getByPath(currentContent, p).push(newBlock(type));
    setDirty();
    refreshEditor();
  }
  if (b.dataset.addImage) {
    getByPath(currentContent, b.dataset.addImage).push({
      src: "",
      caption: "",
      alt: "",
    });
    setDirty();
    refreshEditor();
  }
  if (b.dataset.addLine) {
    getByPath(currentContent, b.dataset.addLine).push("");
    setDirty();
    refreshEditor();
  }
  if (b.dataset.addLink) {
    getByPath(currentContent, b.dataset.addLink).push({
      label: "",
      href: "",
      description: "",
    });
    setDirty();
    refreshEditor();
  }
  if (b.hasAttribute("data-add-campus")) {
    currentContent.campus.images.push({ src: "", title: "", alt: "" });
    setDirty();
    refreshEditor();
  }
  if (b.dataset.clearImage) {
    previousRemoval = structuredClone(currentContent);
    setPath(b.dataset.clearImage, "");
    document.querySelector("[data-undo]").hidden = false;
    setDirty();
    refreshEditor();
  }
  if (b.dataset.move) {
    const arr = getByPath(currentContent, b.dataset.move),
      i = Number(b.dataset.index),
      j = i + Number(b.dataset.direction);
    if (j >= 0 && j < arr.length) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      setDirty();
      refreshEditor();
    }
  }
  if (b.dataset.remove) {
    previousRemoval = structuredClone(currentContent);
    getByPath(currentContent, b.dataset.remove).splice(
      Number(b.dataset.index),
      1,
    );
    document.querySelector("[data-undo]").hidden = false;
    setDirty();
    refreshEditor();
    showToast("已從編輯稿移除，可按「復原移除」。儲存後才會更新網站。");
  }
  if (b.hasAttribute("data-undo") && previousRemoval) {
    currentContent = previousRemoval;
    previousRemoval = null;
    b.hidden = true;
    setDirty();
    refreshEditor();
  }
  if (b.hasAttribute("data-save")) saveContent();
  if (b.hasAttribute("data-preview")) preview();
  if (b.hasAttribute("data-preview-article")) preview(true);
  if (b.hasAttribute("data-help"))
    document.querySelector("[data-help-dialog]").showModal();
  if (b.hasAttribute("data-close-help"))
    document.querySelector("[data-help-dialog]").close();
  if (b.hasAttribute("data-export")) {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(currentContent, null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "site-content-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (b.hasAttribute("data-logout")) {
    if (dirty && !confirm("有未儲存的修改，確定登出？")) return;
    if (serverMode) apiPost("api/logout.php", {}).catch(() => {});
    sessionStorage.removeItem("ychcthwps-admin-session");
    dirty = false;
    location.reload();
  }
});
document
  .querySelector("[data-login-form]")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target),
      username = String(form.get("username")).trim(),
      password = String(form.get("password"));
    const error = document.querySelector("[data-login-error]");
    try {
      if (serverAvailable) {
        await apiPost("api/login.php", { username, password });
        serverMode = true;
      } else {
        if (username !== "teacher" || password !== "ych2026")
          throw Error("登入資料不正確。");
        sessionStorage.setItem("ychcthwps-admin-session", "true");
      }
      error.hidden = true;
      await initDashboard();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
(async () => {
  try {
    const r = await fetch("api/status.php", { credentials: "same-origin" });
    if (r.ok) {
      const status = await r.json();
      serverAvailable = true;
      if (status.loggedIn || status.authenticated) {
        serverMode = true;
        await initDashboard();
        return;
      }
    }
  } catch {}
  document.querySelector("[data-demo-hint]").hidden = serverAvailable;
  if (
    !serverAvailable &&
    sessionStorage.getItem("ychcthwps-admin-session") === "true"
  )
    await initDashboard();
})().catch((e) => showToast(e.message));
