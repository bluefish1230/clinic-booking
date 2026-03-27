# 🏥 診所預約管理系統 (clinic-booking)

這是一個基於 **LINE LIFF**、**Node.js** 與 **MySQL** 構建的診所預約系統。採用 **GitHub Primer** 設計風格，提供極簡、專業且流暢的管理體驗。

---

## 🚀 系統核心流程 (Workflow)

### 1. 使用者端 (LINE LIFF)
- **進入系統**：使用者點擊 LINE 官方帳號的選單進入預約網頁。
- **日期選取**：系統自動抓取日曆。**週六、週日與國定假日**預設為「休假」不可選取。
- **預約時段**：使用者從剩餘空檔中選取時段並填寫備註。
- **提交申請**：資料寫入資料庫，狀態標記為 `pending` (待審核)。

### 2. 管理員端 (Admin Console)
- **登入驗證**：進入 `/admin.html` 需輸入管理員密碼（由環境變數控管）。
- **審核預約**：
  - **核定 (Approve)**：將預約狀態轉為正式紀錄。
  - **退回 (Reject)**：釋出該時段供他人重新預約。
- **日曆管理**：
  - **強制開放**：讓特定休假日常態開放（如：視訊特別門診）。
  - **強制關閉**：設定特定日期為休診日（如：醫師出國或工程維修）。

---

## 🛠 技術架構 (Tech Stack)

- **前端 (Frontend)**：HTML5, CSS (Vanilla CSS / GitHub style), JavaScript ES6+
- **後端 (Backend)**：Node.js with Express.js Framework
- **資料庫 (Database)**：MySQL (存放預約紀錄與日曆設定)
- **部署平台 (Deployment)**：Zeabur (Node.js & MySQL)
- **通訊平台 (Platform)**：LINE Messaging API / LIFF

---

## ⚙️ 關鍵設定 (Environment Variables)

若要確保系統正常運作，請在 **Zeabur** 的服務環境變數中設定以下值：

| 變數名稱 | 說明 | 範例值 |
|---|---|---|
| `ADMIN_PASSWORD` | 管理後台登入密碼 (預設 1234) | `your_secret_pwd` |
| `MYSQL_HOST` | MySQL 伺服器主機名 | `mysql.zeabur.internal` |
| `MYSQL_USERNAME` | MySQL 使用者名稱 | `root` |
| `MYSQL_PASSWORD` | MySQL 密碼 | `********` |
| `MYSQL_DATABASE` | 資料庫名稱 | `clinic` |

---

## 📂 專案目錄結構

```text
clinic-booking/
├── frontend/           # 前端靜態檔案 (Static UI)
│   ├── index.html      # 使用者預約首頁
│   ├── app.js          # 使用者端 API 串接邏輯
│   ├── style.css       # 使用者端介面樣式
│   ├── admin.html      # 管理員登入與控制台
│   ├── admin.js        # 管理員控制台邏輯
│   └── admin.css       # GitHub 風格樣式表
├── server.js           # Express API 伺服器 & 日曆邏輯
├── package.json        # 專案依賴管理
└── README.md           # 專案說明文件 (本檔案)
```

---

## 🎨 管理介面預覽 (GitHub Style)

本系統的管理後台採用與 GitHub 一致的視覺設計：
- **一致性**：使用與 GitHub 相同的色點、邊框與間距。
- **分頁管理**：清單式管理 `待審核` 與 `已確認` 的預約。
- **例外設定**：視覺化設定日曆開啟/關閉狀態。

---

## 📝 未來擴充計畫 (Roadmap)
- [ ] **LINE Push Notification**：當預約被核定時，主動發送訊息通知使用者。
- [ ] **使用者取消預約**：允許使用者在指定時間前自行取消。
- [ ] **多位醫師排班**：支援不同診間的多名醫師同步預約。

---
*Developed with ❤️ for Medical Service Management.*
