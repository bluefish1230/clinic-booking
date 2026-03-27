# 🏥 診所預約管理系統 (clinic-booking)

這是一個基於 **LINE LIFF**、**Node.js** 與 **MySQL** 構建的診所預約系統。

---

## 🚀 系統核心流程 (Workflow)

### 1. 使用者端 (LINE LIFF)
- **進入系統**：使用者點擊 LINE 官方帳號的圖文選單進入預約網頁。
- **日曆排列**：日曆採用 **週一至週日** 的標準格式排列，方便使用者對接生活習慣。
- **預約範圍 (Time Window)**：
  - **起始時間**：僅開放 **「現在時間 + 4 小時」** 之後的時段（確保診所有緩衝準備時間）。
  - **結束時間**：最長可預約至 **60 天 (約 2 個月)** 內的日期。
- **視覺標記**：預設的 **週六、週日、國定假日** 以及管理員手動設定的 **休息日**，在日曆上均顯示為 **紅色**。
- **提交申請**：資料寫入 MySQL，狀態標記為 `pending` (待審核)。

### 2. 管理員端 (Admin Console)
- **登入驗證**：進入 `/admin.html` 需輸入管理員密碼（由環境變數 `ADMIN_PASSWORD` 控管）。
- **審核預約**：
  - **核定 (Approve)**：正式排入診次。
  - **退回 (Reject)**：釋出該時段供他人預約。
- **日曆例外設定 (Calendar Override)**：
  - 管理員可隨時指定任何日期為 **「強制開放」**（綠色標籤）或 **「強制關閉」**（紅色標籤）。
  - 例如：補班日手動開放週六，或醫師休假手動關閉平日。

---

## 🛠 技術架構 (Tech Stack)

- **前端 (Frontend)**：HTML5, CSS (Vanilla CSS / GitHub style), JavaScript ES6+
- **後端 (Backend)**：Node.js with Express.js Framework
- **資料庫 (Database)**：MySQL (Zeabur Hosted)
- **部署平台 (Deployment)**：Zeabur

---

## ⚙️ 關鍵環境變數 (Environment Variables)

請在 **Zeabur** 中設定以下變數以確保功能正常：

| 變數名稱 | 說明 | 範例值 |
|---|---|---|
| `ADMIN_PASSWORD` | 管理後台登入密碼 | `1234` |
| `MYSQL_HOST` | MySQL 伺服器主機 | `mysql.zeabur.internal` |
| `MYSQL_USERNAME` | 使用者名稱 | `root` |
| `MYSQL_PASSWORD` | 資料庫密碼 | `********` |
| `MYSQL_DATABASE` | 資料庫名稱 | `clinic` |

---

## 📂 專案目錄結構

- `frontend/`：靜態網頁檔案（包含使用者與管理員介面）。
- `server.js`：核心 API 伺服器，處理預約、日曆邏輯與 MySQL 串接。
- `README.md`：本說明文件。

---

## 📝 當前規則彙整
- [x] 日曆橫向對齊週一至週日。
- [x] 休診日字體自動變紅。
- [x] 自動隱藏當天 4 小時內的時段。
- [x] 開放 60 天預約視窗。
- [x] 管理後台密碼保護。

---
*Developed with ❤️ for Medical Service Management.*
