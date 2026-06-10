const ADMIN_SESSION_KEY = "ychcthwps-admin-session";
const ADMIN_USERNAME = "teacher";
const ADMIN_PASSWORD = "ych2026";

const loginPanel = document.querySelector("[data-login-panel]");
const dashboard = document.querySelector("[data-dashboard]");
const loginForm = document.querySelector("[data-login-form]");
const editorForm = document.querySelector("[data-editor-form]");
const newsEditor = document.querySelector("[data-news-editor]");
const toast = document.querySelector("[data-toast]");

let currentContent;
let serverMode = false;

function isLoggedIn() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function setLoggedIn(value) {
  if (value) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  document.body.classList.add("is-authenticated");
  window.scrollTo({ top: 0, behavior: "auto" });
}

function showLogin() {
  loginPanel.hidden = false;
  dashboard.hidden = true;
  document.body.classList.remove("is-authenticated");
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setValueByPath(source, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((object, key) => {
    object[key] ||= {};
    return object[key];
  }, source);
  target[lastKey] = value;
}

function ensureDefaultCollections(content) {
  content.campus ||= {};
  content.campus.images ||= [];
  while (content.campus.images.length < 2) {
    content.campus.images.push({ src: "", alt: "", title: "" });
  }
  content.tender ||= {};
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
}

function uniqueArticleSlug(index) {
  return `notice-${Date.now()}-${index + 1}`;
}

function renderNewsEditor(items = []) {
  newsEditor.replaceChildren();
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "news-item-editor";
    row.dataset.newsIndex = String(index);
    row.innerHTML = `
      <label>分類
        <select data-news-field="category">
          <option value="news">最新消息</option>
          <option value="school">學校資訊</option>
          <option value="activity">活動花絮</option>
          <option value="tender">招標及行政公告</option>
          <option value="admission">入學資訊</option>
        </select>
      </label>
      <label>日期/分類<input data-news-field="date"></label>
      <label>網址代號<input data-news-field="slug" placeholder="例如 school-open-day"></label>
      <label>標題<input data-news-field="title"></label>
      <label>首頁摘要<textarea data-news-field="copy" rows="3"></textarea></label>
      <label>封面圖片路徑<input data-news-field="image"></label>
      <label>上載封面圖片<input type="file" accept="image/*" data-news-image-upload></label>
      <label class="checkbox-label"><input type="checkbox" data-news-field="showOnHome"> 在首頁顯示</label>
      <label class="full-row">詳細內容<textarea data-news-field="content" rows="7"></textarea></label>
      <label class="full-row">指定連結（留空會自動開文章詳情頁）<input data-news-field="linkHref"></label>
      <button type="button" class="remove-news" data-remove-news aria-label="刪除消息">刪除</button>
    `;
    row.querySelector('[data-news-field="category"]').value = item.category || "news";
    row.querySelector('[data-news-field="date"]').value = item.date || "";
    row.querySelector('[data-news-field="slug"]').value = item.slug || "";
    row.querySelector('[data-news-field="title"]').value = item.title || "";
    row.querySelector('[data-news-field="copy"]').value = item.copy || "";
    row.querySelector('[data-news-field="image"]').value = item.image || "";
    row.querySelector('[data-news-field="content"]').value = item.content || item.copy || "";
    row.querySelector('[data-news-field="linkHref"]').value = item.linkHref || "";
    row.querySelector('[data-news-field="showOnHome"]').checked = item.showOnHome !== false;
    newsEditor.append(row);
  });
}

function fillForm(content) {
  ensureDefaultCollections(content);
  editorForm.querySelectorAll("[name]").forEach((input) => {
    if (input.type === "file") return;
    const value = getByPath(content, input.name);
    input.value = typeof value === "string" ? value : "";
  });
  renderNewsEditor(content.news?.items || []);
}

function collectForm() {
  const nextContent = structuredClone(currentContent);
  ensureDefaultCollections(nextContent);
  editorForm.querySelectorAll("[name]").forEach((input) => {
    if (input.type === "file") return;
    setValueByPath(nextContent, input.name, input.value.trim());
  });
  nextContent.news.items = Array.from(newsEditor.querySelectorAll("[data-news-index]")).map((row, index) => {
    const value = (field) => row.querySelector(`[data-news-field="${field}"]`)?.value.trim() || "";
    return {
      date: value("date"),
      category: value("category") || "news",
      slug: value("slug") || uniqueArticleSlug(index),
      title: value("title"),
      copy: value("copy"),
      content: value("content"),
      image: value("image"),
      linkHref: value("linkHref"),
      showOnHome: row.querySelector('[data-news-field="showOnHome"]')?.checked !== false
    };
  });
  return nextContent;
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch("api/upload-image.php", {
    method: "POST",
    credentials: "same-origin",
    body: formData
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Upload failed");
  return data.src;
}

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function downloadJson(content) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "site-content.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function initDashboard() {
  currentContent = await loadSiteContent();
  ensureDefaultCollections(currentContent);
  fillForm(currentContent);
}

async function apiPost(path, payload = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function serverLogin(username, password) {
  await apiPost("api/login.php", { username, password });
  serverMode = true;
}

async function saveContent(content) {
  if (serverMode) {
    await apiPost("api/save-content.php", { content });
    clearStoredContent();
    return "server";
  }

  try {
    await apiPost("api/save-content.php", { content });
    clearStoredContent();
    serverMode = true;
    return "server";
  } catch {
    saveStoredContent(content);
    return "browser";
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const error = document.querySelector("[data-login-error]");

  try {
    await serverLogin(username, password);
    setLoggedIn(true);
    error.hidden = true;
    showDashboard();
    await initDashboard();
    showToast("已連接學校 server database。");
    return;
  } catch {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setLoggedIn(true);
      error.hidden = true;
      showDashboard();
      await initDashboard();
      showToast("已進入本地示範模式。");
      return;
    }
  }

  error.hidden = false;
});

editorForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  currentContent = collectForm();
  const target = await saveContent(currentContent);
  showToast(target === "server" ? "已儲存到學校 server database。" : "已暫存到本機瀏覽器，可到首頁預覽。");
});

document.querySelector("[data-add-news]")?.addEventListener("click", () => {
  currentContent = collectForm();
  const index = currentContent.news.items.length;
  currentContent.news.items.push({
    date: "最新消息",
    category: "news",
    slug: uniqueArticleSlug(index),
    title: "請輸入標題",
    copy: "請輸入首頁摘要",
    content: "請輸入詳細內容",
    image: "",
    linkHref: "",
    showOnHome: true
  });
  renderNewsEditor(currentContent.news.items);
});

editorForm?.addEventListener("change", async (event) => {
  const newsImageInput = event.target.closest("[data-news-image-upload]");
  if (newsImageInput?.files?.[0]) {
    const row = newsImageInput.closest("[data-news-index]");
    const targetInput = row?.querySelector('[data-news-field="image"]');
    if (!targetInput) return;

    try {
      const src = await uploadImage(newsImageInput.files[0]);
      targetInput.value = src;
      showToast("文章封面圖片已上載到學校 server。");
    } catch {
      const dataUrl = await imageToDataUrl(newsImageInput.files[0]);
      targetInput.value = dataUrl;
      showToast("文章封面圖片已暫存到本機預覽。");
    }
    return;
  }

  const input = event.target.closest("[data-image-upload]");
  if (!input || !input.files?.[0]) return;

  const targetName = input.dataset.imageTarget;
  const targetInput = editorForm.querySelector(`[name="${targetName}"]`);
  if (!targetInput) return;

  try {
    const src = await uploadImage(input.files[0]);
    targetInput.value = src;
    showToast("圖片已上載到學校 server。");
  } catch {
    const dataUrl = await imageToDataUrl(input.files[0]);
    targetInput.value = dataUrl;
    showToast("圖片已暫存到本機預覽。");
  }
});

newsEditor?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-news]");
  if (!button) return;
  currentContent = collectForm();
  const row = button.closest("[data-news-index]");
  const index = Number(row.dataset.newsIndex);
  currentContent.news.items.splice(index, 1);
  renderNewsEditor(currentContent.news.items);
});

document.querySelector("[data-reset]")?.addEventListener("click", async () => {
  clearStoredContent();
  currentContent = await fetchDefaultContent();
  fillForm(currentContent);
  showToast("已重設為資料檔內容。");
});

document.querySelector("[data-export]")?.addEventListener("click", () => {
  currentContent = collectForm();
  downloadJson(currentContent);
});

document.querySelectorAll("[data-logout]").forEach((button) => {
  button.addEventListener("click", () => {
    if (serverMode) {
      apiPost("api/logout.php").catch(() => {});
    }
    setLoggedIn(false);
    serverMode = false;
    showLogin();
  });
});

if (isLoggedIn()) {
  showDashboard();
  initDashboard().catch(() => showToast("未能載入內容資料。"));
} else {
  showLogin();
}
