# 仁濟醫院趙曾學韞小學網站重設概念

這是一個可直接預覽的網站版本，並已預留 PHP server database 後台。

## 檔案

- `index.html`：首頁內容及資訊架構
- `styles.css`：桌面與手機版樣式
- `script.js`：手機選單及頁首互動
- `content-manager.js`：讀取及套用網站內容資料
- `admin.html` / `admin.css` / `admin.js`：簡單後台登入及內容編輯介面
- `api/`：PHP API，負責登入、讀取內容、儲存內容到學校 server database
- `api/upload-image.php`：後台圖片上載 API，正式 server 會把圖片保存到 `assets/uploads/`
- `tender.html`：招標及行政公告詳細頁
- `data/site-content.json`：首頁可更新內容資料
- `assets/school-logo.png`：由現有網站保存的校徽資產
- `assets/official-students-hero-2400.jpg`：由學校官方相簿保存並壓縮的學生校服活動相片，用於首頁大圖
- `assets/official-students-hero.jpg`：官方相簿原尺寸備份
- `assets/campus-learning-hero.png`：早期生成概念圖，已不再用於首頁，避免校服不準確

## 內容來源與備註

新版保留現有網站可見的主要導覽結構：關於趙小、學與教、多元體驗、eClass、Facebook，以及最新消息、學校資訊、活動花絮、加入趙小、招標、課程發展、語文學習、STEAM、個人成長、其他學習經歷、課外活動、走出課室及星級導師等內容分類。

原有供應商提供的校園導賞團連結已移除。除非校方擁有 VR 原始檔及授權，否則不建議把供應商內容直接搬到學校 server。新版已改為校園環境展示區，並預留後台圖片上載欄位，日後可放校方自家相片、影片或授權 VR 檔案。

首頁大圖已改用學校官方相簿的學生相片，避免出現不符合仁濟醫院趙曾學韞小學校服的生成圖片。

地址、電話、電郵、校長姓名及最新通告等正式資料，建議由校方確認後再加入。

## 後台示範

打開 `admin.html` 可以登入內容管理介面。

- 使用者名稱：`teacher`
- 示範密碼：`ych2026`

如果網站放在支援 PHP 的學校 server，後台會優先呼叫 `api/`，把老師更新的內容寫入 server database，圖片會上載到 `assets/uploads/`。若只用靜態方式打開，後台會暫存在同一瀏覽器的 localStorage，方便校方試用流程；亦可在後台下載新的 `site-content.json`。

## 學校 Server 部署

1. 將整個資料夾上載到學校 PHP server。
2. 複製 `api/config.example.php` 為 `api/config.php`。
3. 如果用 SQLite，可保持預設設定，但要確保 `data/` 可由 PHP 寫入。
4. 確保 `assets/uploads/` 可由 PHP 寫入，供後台上載圖片。
5. 如果用 MySQL，把 `api/config.php` 入面的 `database` 改成 MySQL host、database、username、password。
6. 正式上線前請更改老師登入密碼及 hash。
