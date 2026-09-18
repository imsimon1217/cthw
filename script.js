const header = document.querySelector("[data-header]");
const menu = document.querySelector("[data-menu]");
const menuToggle = document.querySelector("[data-menu-toggle]");

function setHeaderState() {
  header?.classList.toggle("is-scrolled", window.scrollY > 18);
}

function closeMenu() {
  menu?.classList.remove("is-open");
  header?.classList.remove("menu-active");
  document.body.classList.remove("menu-open");
  menuToggle?.setAttribute("aria-expanded", "false");
}

menuToggle?.addEventListener("click", () => {
  const willOpen = menuToggle.getAttribute("aria-expanded") !== "true";
  menu?.classList.toggle("is-open", willOpen);
  header?.classList.toggle("menu-active", willOpen);
  document.body.classList.toggle("menu-open", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
});

menu?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    closeMenu();
  }
});

window.addEventListener("scroll", setHeaderState, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth > 980) closeMenu();
});

setHeaderState();

loadSiteContent()
  .then(applyContent)
  .catch(() => {
    document.documentElement.classList.add("content-fallback");
    const page = document.querySelector("[data-page-content]");
    if (page)
      page.innerHTML =
        '<div class="page-missing"><h1>暫時未能載入內容</h1><p>請重新整理頁面，或稍後再試。</p><a href="index.html">返回首頁 →</a></div>';
  });
