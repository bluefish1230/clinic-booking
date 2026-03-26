const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('frontend'));

// =============================================
// MySQL 連線設定（從環境變數讀取，Zeabur 會自動注入）
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

let pool;

async function initDB() {
    pool = mysql.createPool(dbConfig);

    // 初始化資料表
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

    console.log('✅ 資料庫連線成功，資料表已就緒');
}

// =============================================
// API 1: 獲取指定日期的時段狀態
// =============================================
app.get('/api/slots/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const [rows] = await pool.execute(
            `SELECT slot_time, status FROM bookings
             WHERE booking_date = ? AND status NOT IN ('rejected', 'cancelled')`,
            [date]
        );
        res.json({ date, bookings: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// API 2: 使用者提交預約
// =============================================
app.post('/api/bookings', async (req, res) => {
    try {
        const { line_user_id, display_name, booking_date, slot_time, note } = req.body;

        // 檢查時段是否已被預約
        const [existing] = await pool.execute(
            `SELECT id FROM bookings
             WHERE booking_date = ? AND slot_time = ? AND status NOT IN ('rejected', 'cancelled')`,
            [booking_date, slot_time]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: '此時段已被預約' });
        }

        const [result] = await pool.execute(
            `INSERT INTO bookings (line_user_id, display_name, booking_date, slot_time, note)
             VALUES (?, ?, ?, ?, ?)`,
            [line_user_id, display_name, booking_date, slot_time, note]
        );
        res.json({ id: result.insertId, status: 'pending' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// API 3: 管理員審核 / 更新狀態
// =============================================
app.patch('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const [result] = await pool.execute(
            `UPDATE bookings SET status = ? WHERE id = ?`,
            [status, id]
        );
        res.json({ updated: result.affectedRows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// API 4: 獲取所有待處理預約
// =============================================
app.get('/api/admin/pending', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM bookings WHERE status = 'pending'
             ORDER BY booking_date ASC, slot_time ASC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// API 5: 獲取所有預約（管理員用）
// =============================================
app.get('/api/admin/all', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM bookings ORDER BY booking_date ASC, slot_time ASC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// API 6: 刪除預約（管理員用）
// =============================================
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute(`DELETE FROM bookings WHERE id = ?`, [id]);
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// 啟動伺服器
// =============================================
const PORT = process.env.PORT || 3000;

initDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`✅ 診所預約後端啟動：http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ 資料庫連線失敗：', err.message);
        process.exit(1);
    });
