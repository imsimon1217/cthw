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
}

function showLogin() {
  loginPanel.hidden = false;
  dashboard.hidden = true;
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

function renderNewsEditor(items = []) {
  newsEditor.replaceChildren();
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "news-item-editor";
    row.dataset.newsIndex = String(index);
    row.innerHTML = `
      <label>日期/分類<input data-news-field="date"></label>
      <label>標題<input data-news-field="title"></label>
      <label>內容<textarea data-news-field="copy" rows="3"></textarea></label>
      <button type="button" class="remove-news" data-remove-news aria-label="刪除消息">刪除</button>
    `;
    row.querySelector('[data-news-field="date"]').value = item.date || "";
    row.querySelector('[data-news-field="title"]').value = item.title || "";
    row.querySelector('[data-news-field="copy"]').value = item.copy || "";
    newsEditor.append(row);
  });
}

function fillForm(content) {
  editorForm.querySelectorAll("[name]").forEach((input) => {
    const value = getByPath(content, input.name);
    input.value = typeof value === "string" ? value : "";
  });
  renderNewsEditor(content.news?.items || []);
}

function collectForm() {
  const nextContent = structuredClone(currentContent);
  editorForm.querySelectorAll("[name]").forEach((input) => {
    setValueByPath(nextContent, input.name, input.value.trim());
  });
  nextContent.news.items = Array.from(newsEditor.querySelectorAll("[data-news-index]")).map((row) => ({
    date: row.querySelector('[data-news-field="date"]').value.trim(),
    title: row.querySelector('[data-news-field="title"]').value.trim(),
    copy: row.querySelector('[data-news-field="copy"]').value.trim()
  }));
  return nextContent;
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
  currentContent.news.items.push({
    date: "新消息",
    title: "請輸入標題",
    copy: "請輸入內容"
  });
  renderNewsEditor(currentContent.news.items);
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

document.querySelector("[data-logout]")?.addEventListener("click", () => {
  if (serverMode) {
    apiPost("api/logout.php").catch(() => {});
  }
  setLoggedIn(false);
  serverMode = false;
  showLogin();
});

if (isLoggedIn()) {
  showDashboard();
  initDashboard().catch(() => showToast("未能載入內容資料。"));
} else {
  showLogin();
}
