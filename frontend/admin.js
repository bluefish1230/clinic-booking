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

async function fetchBookings() {
    if (!adminPwd) return;

    // 抓取待審核
    const resPending = await fetch(`/api/admin/pending?pwd=${adminPwd}`);
    const pendingData = await resPending.json();

    // 抓取全部
    const resAll = await fetch(`/api/admin/all?pwd=${adminPwd}`);
    const allData = await resAll.json();

    renderLists(pendingData, allData);
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
        </div>
    `;
    return item;
}

async function updateStatus(id, status) {
    await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, pwd: adminPwd }) // 這裡視後端邏輯調整
    });
    fetchBookings();
}

// =============================================
// 日曆例外設定邏輯
// =============================================
async function fetchCalendarSettings() {
    const res = await fetch('/api/admin/calendar-all');
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

fetchBookings();
