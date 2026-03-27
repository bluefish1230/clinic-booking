const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('frontend'));

const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USERNAME || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'clinic',
    waitForConnections: true,
    connectionLimit: 10,
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.PASSWORD || '0811';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''; // 請將 Token 放入環境變數
const LINE_ADMIN_USER_ID = process.env.LINE_ADMIN_USER_ID || ''; // 管理員的 LINE User ID

let pool;

async function initDB() {
    pool = mysql.createPool(dbConfig);
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

    // 無痛加上新欄位
    try { await pool.execute(`ALTER TABLE bookings ADD COLUMN phone VARCHAR(20) DEFAULT ''`); } catch (e) { /* ignore if exists */ }
    try { await pool.execute(`ALTER TABLE bookings ADD COLUMN line_id VARCHAR(50) DEFAULT ''`); } catch (e) { /* ignore if exists */ }

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS calendar_settings (
            target_date DATE PRIMARY KEY,
            is_open     TINYINT(1) NOT NULL
        )
    `);
    console.log('✅ 資料庫連線與初始化成功');
}

function isDefaultClosed(dateString) {
    const date = new Date(dateString);
    const day = date.getDay();
    if (day === 0 || day === 6) return true;
    const holidays = ['2026-04-03', '2026-04-04', '2026-04-05', '2026-05-01', '2026-06-19'];
    return holidays.includes(dateString);
}

// ---------------------------------------------
// LINE Messaging API 輔助函數
// ---------------------------------------------
async function sendPushNotification(to, text) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn('⚠️ 尚未設定 LINE_CHANNEL_ACCESS_TOKEN，跳過推播');
        return;
    }

    // 若 text 為純文字則包裝，若為物件則直接作為 messages 的內容 (支援 Flex Message)
    const messages = typeof text === 'string' ? [{ type: 'text', text: text }] : [text];

    const data = JSON.stringify({
        to: to,
        messages: messages
    });

    const options = {
        hostname: 'api.line.me',
        port: 443,
        path: '/v2/bot/message/push',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (d) => responseBody += d);
        res.on('end', () => {
            if (res.statusCode === 200) console.log('✅ LINE 推播成功');
            else console.error('❌ LINE 推播失敗:', responseBody);
        });
    });

    req.on('error', (e) => console.error('❌ LINE 推播發生錯誤:', e));
    req.write(data);
    req.end();
}

// ---------------------------------------------
// USER API
// ---------------------------------------------

// 獲取個人清單 (依據 LINE ID)
app.get('/api/bookings/user/:lineId', async (req, res) => {
    try {
        const { lineId } = req.params;
        const [rows] = await pool.execute(
            `SELECT * FROM bookings WHERE line_user_id = ? ORDER BY booking_date DESC, slot_time DESC`,
            [lineId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 使用者自行取消預約
app.patch('/api/bookings/user/cancel/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { lineId } = req.body; // 安全起見驗證 LINE ID
        const [result] = await pool.execute(
            `UPDATE bookings SET status = 'cancelled' WHERE id = ? AND line_user_id = ? AND status != 'rejected'`,
            [id, lineId]
        );
        res.json({ success: true, updated: result.affectedRows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 獲取時段
app.get('/api/slots/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const [settings] = await pool.execute(`SELECT is_open FROM calendar_settings WHERE target_date = ?`, [date]);
        let openStatus = settings.length > 0 ? (settings[0].is_open === 1) : !isDefaultClosed(date);

        if (!openStatus) return res.json({ date, isDayOpen: false, bookings: [] });

        const [rows] = await pool.execute(
            `SELECT slot_time, status FROM bookings WHERE booking_date = ? AND status NOT IN ('rejected', 'cancelled')`,
            [date]
        );
        res.json({ date, isDayOpen: true, bookings: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 使用者提交預約
app.post('/api/bookings', async (req, res) => {
    try {
        const { line_user_id, display_name, phone, line_id, picture_url, booking_date, slot_time, note } = req.body;
        const [result] = await pool.execute(
            `INSERT INTO bookings (line_user_id, display_name, phone, line_id, booking_date, slot_time, note) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [line_user_id, display_name, phone || '', line_id || '', booking_date, slot_time, note]
        );

        // 通知管理員有新預約 (Flex Message)
        if (LINE_ADMIN_USER_ID) {
            const dateStr = new Date(booking_date).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });

            const flexMsg = {
                type: 'flex',
                altText: `【新預約通知】來自 ${display_name}`,
                contents: {
                    type: 'bubble',
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'md',
                        contents: [
                            { type: 'text', text: '🔔 新預約通知', weight: 'bold', size: 'lg', color: '#1DB446' },
                            {
                                type: 'box',
                                layout: 'horizontal',
                                spacing: 'md',
                                margin: 'md',
                                // 此處將動態根據有無頭像填入內容
                                contents: []
                            },
                            { type: 'text', text: '請前往後台審核。', margin: 'lg', size: 'sm', color: '#999999' }
                        ]
                    }
                }
            };

            const infoBox = flexMsg.contents.body.contents[1].contents;

            if (picture_url && picture_url.length > 0) {
                infoBox.push({
                    type: 'image',
                    url: picture_url,
                    flex: 1,
                    size: 'sm',
                    aspectMode: 'cover',
                    aspectRatio: '1:1',
                    gravity: 'center'
                });
            }

            infoBox.push({
                type: 'box',
                layout: 'vertical',
                flex: 4,
                spacing: 'sm',
                contents: [
                    { type: 'text', text: `預約人：${display_name}`, weight: 'bold', wrap: true },
                    { type: 'text', text: `日期：${dateStr}`, size: 'sm', color: '#666666' },
                    { type: 'text', text: `時段：${slot_time}`, size: 'sm', color: '#666666' },
                    { type: 'text', text: `手機：${phone || '未提供'}`, size: 'sm', color: '#ff6b6b', weight: 'bold' },
                    ...(line_id ? [{ type: 'text', text: `LINE ID：${line_id}`, size: 'sm', color: '#0969da', weight: 'bold' }] : []),
                    ...(note ? [{ type: 'text', text: `備註：${note}`, size: 'sm', color: '#666666', wrap: true, margin: 'sm' }] : [])
                ]
            });

            await sendPushNotification(LINE_ADMIN_USER_ID, flexMsg);
        }

        res.json({ id: result.insertId, status: 'pending' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------
// LINE Webhook (接收使用者訊息 / 查詢 User ID)
// ---------------------------------------------
app.post('/webhook', async (req, res) => {
    res.sendStatus(200); // 先回應 LINE 伺服器
    const events = req.body.events;
    if (!events || events.length === 0) return;

    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const text = event.message.text;
            console.log(`📩 收到訊息 | User ID: ${userId} | 內容: ${text}`);

            // 當使用者傳「我的ID」時，回覆他的 User ID
            if (text.trim() === '我的ID' || text.trim() === '我的id') {
                await sendPushNotification(userId, `您的 LINE User ID 為：\n${userId}\n\n請將此 ID 提供給管理員設定通知功能。`);
            }
        }
    }
});

// ---------------------------------------------
// ADMIN API
// ---------------------------------------------
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ success: false, error: '密碼錯誤' });
});

app.get('/api/admin/pending', async (req, res) => {
    if (req.query.pwd !== ADMIN_PASSWORD) return res.status(403).send('Forbidden');
    const [rows] = await pool.execute(`SELECT * FROM bookings WHERE status = 'pending' ORDER BY booking_date ASC, slot_time ASC`);
    res.json(rows);
});

app.get('/api/admin/all', async (req, res) => {
    if (req.query.pwd !== ADMIN_PASSWORD) return res.status(403).send('Forbidden');
    const [rows] = await pool.execute(`SELECT * FROM bookings ORDER BY booking_date ASC, slot_time ASC`);
    res.json(rows);
});

app.patch('/api/bookings/:id', async (req, res) => {
    const { pwd, status, customMessage } = req.body;
    if (pwd !== ADMIN_PASSWORD) return res.status(403).send('Forbidden');

    // 1. 取得預約及使用者資訊
    const [rows] = await pool.execute(`SELECT * FROM bookings WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '查無此筆預約' });
    const booking = rows[0];

    // 2. 更新資料庫
    const [result] = await pool.execute(`UPDATE bookings SET status = ? WHERE id = ?`, [status, req.params.id]);

    // 3. 發送 LINE 通知 (如果有 User ID)
    if (booking.line_user_id) {
        let message = '';
        const dateStr = new Date(booking.booking_date).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
        if (customMessage) {
            message = customMessage;
        } else if (status === 'approved') {
            message = `✅ 【預約確認通知】\n\n您好，${booking.display_name}！\n您的預約已通過審核。\n\n📅 日期：${dateStr}\n🕐 時段：${booking.slot_time}\n\n請準時前來，期待您的光臨！`;
        } else if (status === 'rejected') {
            message = `❌ 【預約通知】\n\n很抱歉，您的預約申請未通過。\n\n📅 日期：${dateStr}\n🕐 時段：${booking.slot_time}\n\n如有疑問請致電診所，謝謝。`;
        }
        if (message) await sendPushNotification(booking.line_user_id, message);
    }

    res.json({ updated: result.affectedRows });
});

app.post('/api/admin/message', async (req, res) => {
    const { pwd, line_user_id, message } = req.body;
    if (pwd !== ADMIN_PASSWORD) return res.status(403).send('Forbidden');
    if (!line_user_id || !message) return res.status(400).send('Bad Request');

    await sendPushNotification(line_user_id, message);
    res.json({ success: true });
});

app.delete('/api/bookings/:id', async (req, res) => {
    if (req.query.pwd !== ADMIN_PASSWORD) return res.status(403).send('Forbidden');
    await pool.execute(`DELETE FROM bookings WHERE id = ?`, [req.params.id]);
    res.json({ deleted: true });
});

app.post('/api/admin/calendar', async (req, res) => {
    const { password, target_date, is_open } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: '密碼錯誤' });
    await pool.execute(`INSERT INTO calendar_settings (target_date, is_open) VALUES (?, ?) ON DUPLICATE KEY UPDATE is_open = ?`, [target_date, is_open, is_open]);
    res.json({ success: true });
});

app.get('/api/admin/calendar-all', async (req, res) => {
    const [rows] = await pool.execute(`SELECT * FROM calendar_settings`);
    res.json(rows);
});

app.delete('/api/admin/calendar/:date', async (req, res) => {
    if (req.query.pwd !== ADMIN_PASSWORD) return res.status(403).send('Forbidden');
    await pool.execute(`DELETE FROM calendar_settings WHERE target_date = ?`, [req.params.date]);
    res.json({ deleted: true });
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
});
