// 管理員密碼密鑰 (暫存於瀏覽器 session)
let adminPwd = sessionStorage.getItem('admin_pwd') || '';

// 初始檢查登入狀態
if (adminPwd) {
    document.getElementById('login-overlay').style.display = 'none';
}

async function checkLogin() {
    const pwd = document.getElementById('admin-pwd-input').value;
    const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
    });
    const result = await response.json();
    if (result.success) {
        adminPwd = pwd;
        sessionStorage.setItem('admin_pwd', pwd);
        document.getElementById('login-overlay').style.display = 'none';
        fetchBookings();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

function logout() {
    sessionStorage.removeItem('admin_pwd');
    location.reload();
}

// 存放所有伺服器傳來的預約資料，供行事曆過濾使用
let globalAllBookings = [];

async function fetchBookings() {
    if (!adminPwd) return;

    // 抓取待審核 (加入 no-store 避免瀏覽器快取)
    const resPending = await fetch(`/api/admin/pending?pwd=${adminPwd}`, { cache: 'no-store' });
    const pendingData = await resPending.json();

    const resAll = await fetch(`/api/admin/all?pwd=${adminPwd}`, { cache: 'no-store' });
    const allData = await resAll.json();
    globalAllBookings = allData; // 存入全域供行事曆與其他分頁使用

    renderLists(pendingData, allData);
    renderPatients(); // 計算與渲染病患人數
    if (document.getElementById('panel-schedule').classList.contains('active')) {
        renderSchedule();
    }
}

function renderLists(pendingBookings, allBookings) {
    const pendingContainer = document.getElementById("pending-list");
    const allContainer = document.getElementById("all-list");

    pendingContainer.innerHTML = '';
    allContainer.innerHTML = '';

    document.getElementById('pending-count').textContent = pendingBookings.length;
    document.getElementById('all-count').textContent = allBookings.length;

    pendingBookings.forEach(b => pendingContainer.appendChild(createBookingItem(b)));
    allBookings.forEach(b => allContainer.appendChild(createBookingItem(b)));
}

function createBookingItem(booking) {
    const item = document.createElement('div');
    item.className = 'booking-item';
    const statusText = booking.status === 'pending' ? '待審核' : (booking.status === 'approved' ? '已核准' : '已取消');
    const badgeClass = booking.status === 'pending' ? 'badge-pending' : (booking.status === 'approved' ? 'badge-approved' : 'badge-rejected');

    item.innerHTML = `
        <div class="info">
            <span class="user-name">${booking.display_name} <span class="badge ${badgeClass}">${statusText}</span></span>
            <span class="booking-detail">${booking.booking_date.split('T')[0]} | ${booking.slot_time}</span>
            ${booking.note ? `<span class="note">${booking.note}</span>` : ''}
        </div>
        <div class="actions">
            ${booking.status === 'pending' ? `
                <button class="btn-approve" onclick="updateStatus(${booking.id}, 'approved')">核准</button>
                <button class="btn-reject" onclick="updateStatus(${booking.id}, 'rejected')">拒絕</button>
            ` : `<button class="btn-delete" onclick="deleteBooking(${booking.id})">刪除</button>`}
            ${booking.line_user_id ? `<button class="gh-btn-outline" style="border-color: #0969da; color: #0969da; padding: 4px 8px; font-size: 11px;" onclick="contactUser('${booking.line_user_id}', '${booking.display_name}')">聯絡</button>` : ''}
        </div>
    `;
    return item;
}

async function updateStatus(id, status) {
    let customMessage = '';
    if (status === 'rejected') {
        customMessage = prompt('請輸入退回原因 (可不填，將使用預設通知):');
    }

    await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, pwd: adminPwd, customMessage })
    });
    fetchBookings();
}

async function deleteBooking(id) {
    if (!confirm('確定要刪除這筆預約嗎？')) return;
    await fetch(`/api/bookings/${id}?pwd=${adminPwd}`, { method: 'DELETE' });
    fetchBookings();
}

async function contactUser(lineId, name) {
    const msg = prompt(`發送自訂訊息給 ${name}:`);
    if (!msg) return;

    const res = await fetch('/api/admin/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pwd: adminPwd, line_user_id: lineId, message: msg })
    });
    const result = await res.json();
    if (result.success) alert('訊息已成功傳送！');
    else alert('發送失敗，請確認 API 設定。');
}

// =============================================
// 行事曆查詢邏輯 (查詢特定日期的所有時間預約)
// =============================================
function renderSchedule() {
    const dateStr = document.getElementById('schedule-date').value;
    const list = document.getElementById('schedule-list');
    list.innerHTML = '';
    if (!dateStr) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #57606a;">請在上方的日曆選擇日期以查看預約</div>';
        return;
    }

    // 過濾出特定日期的預約 (不包含已拒絕與已取消的，因為行事曆是要看真正會來的人)
    const dailyBookings = globalAllBookings.filter(b =>
        b.booking_date.split('T')[0] === dateStr &&
        b.status !== 'cancelled' &&
        b.status !== 'rejected'
    );

    if (dailyBookings.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #57606a;">此日期目前沒有任何預約記錄。</div>';
        return;
    }

    // 依據時間先後排序
    dailyBookings.sort((a, b) => a.slot_time.localeCompare(b.slot_time));

    // 將預約元件加入畫面中
    dailyBookings.forEach(b => {
        list.appendChild(createBookingItem(b));
    });
}

// =============================================
// 病患名單 (CRM 客戶關係管理)
// =============================================
function renderPatients() {
    const list = document.getElementById('patients-list');
    if (!list) return;
    list.innerHTML = '';

    // 整理獨特的病患名單 (依據 line_user_id)
    const uniqueUsers = {};
    globalAllBookings.forEach(b => {
        if (b.line_user_id) {
            if (!uniqueUsers[b.line_user_id]) {
                uniqueUsers[b.line_user_id] = {
                    lineId: b.line_user_id,
                    name: b.display_name,
                    bookingCount: 1,
                    lastBooking: b.booking_date.split('T')[0]
                };
            } else {
                uniqueUsers[b.line_user_id].bookingCount++;
                const bDateStr = b.booking_date.split('T')[0];
                if (bDateStr > uniqueUsers[b.line_user_id].lastBooking) {
                    uniqueUsers[b.line_user_id].lastBooking = bDateStr;
                }
                // 更新名字為最新一次預約的名字
                uniqueUsers[b.line_user_id].name = b.display_name;
            }
        }
    });

    const usersArray = Object.values(uniqueUsers);

    const countBadge = document.getElementById('patients-count');
    if (countBadge) countBadge.textContent = usersArray.length;

    const headerCount = document.getElementById('patients-header-count');
    if (headerCount) headerCount.textContent = `共 ${usersArray.length} 位曾預約過的 LINE 病患`;

    if (usersArray.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #57606a;">目前尚無病患資料</div>';
        return;
    }

    // 依據最後預約時間排序 (由新到舊)
    usersArray.sort((a, b) => new Date(b.lastBooking) - new Date(a.lastBooking));

    usersArray.forEach(u => {
        const item = document.createElement('div');
        item.className = 'booking-item';
        item.innerHTML = `
            <div class="info">
                <span class="user-name">${u.name} <span class="badge badge-approved" style="background-color: #2da44e;">總計預約: ${u.bookingCount} 次</span></span>
                <span class="booking-detail">最近一次預約：${u.lastBooking}</span>
            </div>
            <div class="actions">
                <button class="gh-btn-outline" style="border-color: #0969da; color: #0969da; padding: 4px 8px; font-size: 11px;" onclick="contactUser('${u.lineId}', '${u.name}')">主動聯絡</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// =============================================
// 日曆例外設定邏輯
// =============================================
async function fetchCalendarSettings() {
    const res = await fetch('/api/admin/calendar-all', { cache: 'no-store' });
    const settings = await res.json();
    const list = document.getElementById('calendar-settings-list');
    list.innerHTML = '';
    settings.forEach(s => {
        const row = document.createElement('div');
        row.className = 'booking-item';
        row.innerHTML = `
            <div class="info">
                <span class="user-name">${s.target_date.split('T')[0]}</span>
                <span class="booking-detail">${s.is_open ? '✅ 已強制開放' : '❌ 已強制關閉'}</span>
            </div>
            <button class="btn-reject" onclick="deleteCalendarSetting('${s.target_date}')">移除設定</button>
        `;
        list.appendChild(row);
    });
}

async function setCalendarDate() {
    const date = document.getElementById('cal-target-date').value;
    const is_open = parseInt(document.getElementById('cal-status').value);
    if (!date) return alert('請選擇日期');

    await fetch('/api/admin/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd, target_date: date, is_open })
    });
    fetchCalendarSettings();
    alert('設定已保存');
}

async function deleteCalendarSetting(dateStr) {
    if (!confirm(`確定要移除 ${dateStr.split('T')[0]} 的日曆例外設定嗎？`)) return;
    const datePart = dateStr.split('T')[0];
    await fetch(`/api/admin/calendar/${datePart}?pwd=${adminPwd}`, { method: 'DELETE' });
    fetchCalendarSettings();
}

// =============================================
// 手動新增預約邏輯
// =============================================
document.getElementById('manual-date').addEventListener('change', async (e) => {
    const date = e.target.value;
    if (!date) return;
    const res = await fetch(`/api/slots/${date}`);
    const data = await res.json();
    const select = document.getElementById('manual-slot');
    select.innerHTML = '';

    if (!data.isDayOpen) {
        select.innerHTML = '<option value="">本日休診</option>';
        return;
    }

    const allSlots = ["10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
    const bookedSlots = data.bookings.map(b => b.slot_time.substring(0, 5));

    let hasAvailable = false;
    allSlots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        if (bookedSlots.includes(slot)) {
            option.textContent = `${slot} (已額滿)`;
            option.disabled = true;
        } else {
            option.textContent = slot;
            hasAvailable = true;
        }
        select.appendChild(option);
    });

    if (!hasAvailable) {
        select.innerHTML = '<option value="">全日額滿</option>';
    }
});

async function adminCreateBooking() {
    const name = document.getElementById('manual-name').value.trim();
    const date = document.getElementById('manual-date').value;
    const slot = document.getElementById('manual-slot').value;

    if (!name || !date || !slot) return alert("請填妥所有欄位，並選擇有效時段！");

    // 1. 建立預約
    const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            line_user_id: '', // 手動新增無 LINE ID
            display_name: name,
            booking_date: date,
            slot_time: slot,
            note: '櫃檯手動新增'
        })
    });
    const result = await res.json();

    if (result.id) {
        // 2. 將此筆預約自動轉為 approved (繞過通知)
        await fetch(`/api/bookings/${result.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved', pwd: adminPwd, customMessage: 'NO_NOTIFY_MANUAL' })
        });
        alert('預約建立成功！');
        document.getElementById('manual-name').value = '';
        document.getElementById('manual-date').value = '';
        document.getElementById('manual-slot').innerHTML = '';
        fetchBookings();
    } else {
        alert('發生失敗，請稍後再試。');
    }
}

fetchBookings();
