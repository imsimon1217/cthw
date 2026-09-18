// Run against a disposable copy, never the school database.
// node tests/api-smoke.cjs http://127.0.0.1:4175
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || ""))
  throw Error("A disposable localhost PHP server is required");
const root = path.resolve(__dirname, "..");
let cookie = "",
  original;
async function request(endpoint, options = {}, auth = true) {
  const res = await fetch(base + "/api/" + endpoint, {
    ...options,
    headers: {
      ...(auth && cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
  const next = res.headers.get("set-cookie");
  if (auth && next) cookie = next.split(";")[0];
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error(endpoint + ": " + text.slice(0, 500));
  }
  return { status: res.status, data };
}
const post = (endpoint, body, auth = true) =>
  request(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    auth,
  );
(async () => {
  assert.equal(
    (await post("save-content.php", { content: {} }, false)).status,
    401,
  );
  assert.equal(
    (await post("login.php", { username: "teacher", password: "invalid" }))
      .status,
    401,
  );
  assert.equal(
    (await post("login.php", { username: "teacher", password: "ych2026" }))
      .status,
    200,
  );
  assert.equal((await request("status.php")).data.loggedIn, true);
  original = (await request("content.php")).data.content;
  const content = structuredClone(original);
  content.categories.push({
    id: "qa-hidden",
    title: "Hidden test",
    parentId: "",
    visible: false,
    layout: "gallery",
    blocks: [],
  });
  content.categories.push({
    id: "qa-child",
    title: "Hidden ancestor test",
    parentId: "qa-hidden",
    visible: true,
    layout: "news",
    blocks: [],
  });
  content.news.items.push({
    slug: "qa-draft",
    title: "Draft test",
    categoryId: "latest-news",
    status: "draft",
    blocks: [{ type: "text", text: "Not public" }],
  });
  content.news.items.push({
    slug: "qa-hidden-article",
    title: "Hidden article",
    categoryId: "qa-child",
    status: "published",
    blocks: [{ type: "text", text: "Not public" }],
  });
  content.news.items.push({
    slug: "qa-published",
    title: "Published test",
    categoryId: "latest-news",
    status: "published",
    blocks: [
      { type: "text", text: "Public body" },
      {
        type: "gallery",
        images: [
          { src: "assets/test.jpg", caption: "Photo one" },
          { src: "assets/test2.jpg", caption: "Photo two" },
        ],
      },
    ],
  });
  assert.equal((await post("save-content.php", { content })).status, 200);
  assert.deepEqual((await request("content.php")).data.content, content);
  const publicData = (await request("content.php", {}, false)).data.content;
  assert(
    !publicData.news.items.some(
      (a) => a.slug === "qa-draft" || a.slug === "qa-hidden-article",
    ),
  );
  assert(publicData.news.items.some((a) => a.slug === "qa-published"));
  assert(
    !publicData.categories.some(
      (c) => c.id === "qa-hidden" || c.id === "qa-child",
    ),
  );
  const bad = structuredClone(content);
  bad.categories.at(-1).parentId = "qa-child";
  assert.equal((await post("save-content.php", { content: bad })).status, 422);
  assert.deepEqual((await request("content.php")).data.content, content);
  const imageForm = new FormData();
  imageForm.append(
    "image",
    new Blob([fs.readFileSync(path.join(root, "assets/school-logo.png"))], {
      type: "image/png",
    }),
    "test.png",
  );
  const uploadedImage = await request("upload-image.php", {
    method: "POST",
    body: imageForm,
  });
  assert.equal(uploadedImage.status, 200);
  assert.match(uploadedImage.data.src, /^assets\/uploads\//);
  assert.equal((await fetch(base + "/" + uploadedImage.data.src)).status, 200);
  const pdfForm = new FormData();
  pdfForm.append(
    "document",
    new Blob(
      [fs.readFileSync(path.join(root, "assets/documents/p1-application.pdf"))],
      { type: "application/pdf" },
    ),
    "form.pdf",
  );
  const uploadedPDF = await request("upload-document.php", {
    method: "POST",
    body: pdfForm,
  });
  assert.equal(uploadedPDF.status, 200);
  assert.match(uploadedPDF.data.src, /^assets\/uploads\/.+\.pdf$/);
  const fake = new FormData();
  fake.append(
    "document",
    new Blob(["not a PDF"], { type: "application/pdf" }),
    "fake.pdf",
  );
  assert.equal(
    (await request("upload-document.php", { method: "POST", body: fake }))
      .status,
    422,
  );
  assert.equal(
    (await post("save-content.php", { content: original })).status,
    200,
  );
  original = null;
  assert.equal((await post("logout.php", {})).status, 200);
  assert.equal((await request("status.php")).data.loggedIn, false);
  console.log(
    "PASS: login, permissions, database persistence, drafts, hidden parents, validation rollback, image upload, PDF upload, MIME rejection, logout",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (original)
      await post("save-content.php", { content: original }).catch((error) => {
        console.error("Restore failed:", error.message);
        process.exitCode = 1;
      });
  });
