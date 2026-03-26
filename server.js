const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const db = new sqlite3.Database('./bookings.db');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('frontend'));

// 初始化資料庫
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_user_id TEXT,
    display_name TEXT NOT NULL,
    booking_date DATE NOT NULL,
    slot_time TEXT NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

/** 
 * API 1: 獲取指定日期的時段狀態
 */
app.get('/api/slots/:date', (req, res) => {
    const { date } = req.params;
    const sql = `SELECT slot_time, status FROM bookings WHERE booking_date = ? AND status != 'rejected' AND status != 'cancelled'`;
    db.all(sql, [date], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ date, bookings: rows });
    });
});

/** 
 * API 2: 使用者提交預約 
 */
app.post('/api/bookings', (req, res) => {
    const { line_user_id, display_name, booking_date, slot_time, note } = req.body;

    // 檢查時段是否已被預約 (Unique)
    const checkSql = `SELECT id FROM bookings WHERE booking_date = ? AND slot_time = ? AND status NOT IN ('rejected', 'cancelled')`;
    db.get(checkSql, [booking_date, slot_time], (err, row) => {
        if (row) return res.status(400).json({ error: "此時段已被預約" });

        const sql = `INSERT INTO bookings (line_user_id, display_name, booking_date, slot_time, note) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [line_user_id, display_name, booking_date, slot_time, note], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, status: 'pending' });
            // TODO: 發送通知給管理員
        });
    });
});

/** 
 * API 3: 管理員審核/更新狀態
 */
app.patch('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = `UPDATE bookings SET status = ? WHERE id = ?`;
    db.run(sql, [status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
        // TODO: 發送 Push Notification 給使用者
    });
});

/**
 * API 4: 獲取所有待處理預約
 */
app.get('/api/admin/pending', (req, res) => {
    db.all(`SELECT * FROM bookings WHERE status = 'pending' ORDER BY booking_date ASC, slot_time ASC`, [], (err, rows) => {
        res.json(rows);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ LINE 預約後端啟動：http://localhost:${PORT}`);
});
