const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('frontend'));

// =============================================
// MySQL 連線設定
// =============================================
const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USERNAME || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'clinic',
    waitForConnections: true,
    connectionLimit: 10,
};

// 讀取管理員密碼（從環境變數）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

let pool;

async function initDB() {
    pool = mysql.createPool(dbConfig);

    // 1. 預約資料表
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS bookings (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            line_user_id VARCHAR(255),
            display_name VARCHAR(255) NOT NULL,
            booking_date DATE NOT NULL,
            slot_time    VARCHAR(10)  NOT NULL,
            note         TEXT,
            status       VARCHAR(20) DEFAULT 'pending',
            created_at   DATETIME    DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. 日曆例外設定表 (is_open: 1=開放, 0=關閉)
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS calendar_settings (
            target_date DATE PRIMARY KEY,
            is_open     TINYINT(1) NOT NULL
        )
    `);

    console.log('✅ 資料庫連線成功，資料表已就緒');
}

// =============================================
// 輔助函式：判斷是否為預設開放日 (自動抓取日曆邏輯)
// =============================================
function isDefaultOpen(dateString) {
    const date = new Date(dateString);
    const day = date.getDay(); // 0:日, 6:六
    // 預設週六、日不開放
    if (day === 0 || day === 6) return false;

    // 這裡可以擴充國定假日的判斷邏輯（如：帶入清單）
    const nationalHolidays = [
        '2026-04-03', '2026-04-04', '2026-04-05', // 範例：清明節
        '2026-05-01', // 勞動節
        '2026-06-19', // 端午
    ];
    if (nationalHolidays.includes(dateString)) return false;

    return true;
}

// =============================================
// API 1: 獲取指定日期的狀態（包含時段與日曆開放狀態）
// =============================================
app.get('/api/slots/:date', async (req, res) => {
    try {
        const { date } = req.params;

        // A. 查詢管理員設定
        const [settings] = await pool.execute(`SELECT is_open FROM calendar_settings WHERE target_date = ?`, [date]);

        let openStatus = false;
        if (settings.length > 0) {
            openStatus = settings[0].is_open === 1; // 依照管理員設定
        } else {
            openStatus = isDefaultOpen(date); // 依照預設邏輯 (假日/國定假日關閉)
        }

        if (!openStatus) {
            return res.json({ date, isDayOpen: false, bookings: [] });
        }

        // B. 查詢預約狀況
        const [rows] = await pool.execute(
            `SELECT slot_time, status FROM bookings 
             WHERE booking_date = ? AND status NOT IN ('rejected', 'cancelled')`,
            [date]
        );
        res.json({ date, isDayOpen: true, bookings: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// API 7: (管理員) 更新日曆開放狀態
// =============================================
app.post('/api/admin/calendar', async (req, res) => {
    const { password, target_date, is_open } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: '密碼錯誤' });

    try {
        await pool.execute(
            `INSERT INTO calendar_settings (target_date, is_open) VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE is_open = ?`,
            [target_date, is_open, is_open]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// API 8: (管理員) 獲取所有日曆特別設定
// =============================================
app.get('/api/admin/calendar-all', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM calendar_settings`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ...其餘 API (PATCH /api/bookings/:id, GET /api/admin/all 等) 需要驗證密碼 ...
// 為避免程式碼過長，我簡化並保留核心邏輯在管理端 API

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: '密碼錯誤' });
    }
});

// 加上密碼驗證的 Admin API
app.get('/api/admin/pending', async (req, res) => {
    const { pwd } = req.query; // 傳入密碼驗證
    if (pwd !== ADMIN_PASSWORD) return res.status(403).send('Forbidden');
    const [rows] = await pool.execute(`SELECT * FROM bookings WHERE status = 'pending' ORDER BY booking_date ASC, slot_time ASC`);
    res.json(rows);
});

app.get('/api/admin/all', async (req, res) => {
    const { pwd } = req.query;
    if (pwd !== ADMIN_PASSWORD) return res.status(403).send('Forbidden');
    const [rows] = await pool.execute(`SELECT * FROM bookings ORDER BY booking_date ASC, slot_time ASC`);
    res.json(rows);
});

// 使用者提交預約 API (這部分不需要密碼)
app.post('/api/bookings', async (req, res) => {
    try {
        const { line_user_id, display_name, booking_date, slot_time, note } = req.body;
        // 額外檢查預防：如果那天是休息日則不予寫入
        const [settings] = await pool.execute(`SELECT is_open FROM calendar_settings WHERE target_date = ?`, [booking_date]);
        const finalOpen = settings.length > 0 ? settings[0].is_open === 1 : isDefaultOpen(booking_date);
        if (!finalOpen) return res.status(400).json({ error: '當天不開放預約' });

        const [result] = await pool.execute(
            `INSERT INTO bookings (line_user_id, display_name, booking_date, slot_time, note) VALUES (?, ?, ?, ?, ?)`,
            [line_user_id, display_name, booking_date, slot_time, note]
        );
        res.json({ id: result.insertId, status: 'pending' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
initDB().then(() => {
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
});
