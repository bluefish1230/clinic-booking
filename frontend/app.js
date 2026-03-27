// =============================================
//  診所預約系統 - 使用者端核心邏輯 (LIFF 整合)
// =============================================

const liffId = "2009607560-DXAdC5Lj"; // 此處已為您的 LIFF ID
let userData = { userId: null, displayName: '' }; // LINE 使用者資料暫存

const slotsConfig = [
    { time: "10:00" }, { time: "11:00" }, { time: "14:00" }, { time: "15:00" },
    { time: "16:00" }, { time: "17:00" }, { time: "18:00" }, { time: "19:00" },
    { time: "20:00" }, { time: "21:00" }
];

function getTaiwanDateString(dateObj = new Date()) {
    return dateObj.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}

let selectedDate = getTaiwanDateString();
let currentViewDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
let selectedSlot = null;
let currentDayStatus = { isDayOpen: true, bookings: [] };
let customCalendarSettings = [];

// =============================================
// 1. LIFF 初始化 (抓取使用者資訊)
// =============================================
async function initLiff() {
    try {
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            const profile = await liff.getProfile();
            userData.userId = profile.userId;
            userData.displayName = profile.displayName;

            // 預填姓名
            document.getElementById('patient-name').value = profile.displayName;
            // 預留頭像顯示
            document.getElementById('user-avatar').innerHTML = `<img src="${profile.pictureUrl}" style="width:100%; height:100%; object-fit:cover;">`;

            // 偵測是否由「取消按鈕」點開 (URL 帶有 page=my)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('page') === 'my') {
                switchView('mine');
            }
        }
    } catch (err) { console.error("LIFF 載入失敗:", err); }
}

// =============================================
// 2. 獲取個人清單 (僅限本人)
// =============================================
async function fetchMyBookings() {
    if (!userData.userId) return;
    const res = await fetch(`/api/bookings/user/${userData.userId}`);
    const data = await res.json();
    const listContainer = document.getElementById('my-bookings-list');
    listContainer.innerHTML = '';

    if (data.length === 0) {
        listContainer.innerHTML = `<p style="text-align:center; padding:40px; color:#888;">尚無預約紀錄。</p>`;
        return;
    }

    data.forEach(b => {
        const item = document.createElement('div');
        item.className = 'my-booking-item';

        let statusHtml = '';
        const badgeStyle = {
            pending: 'background:#FFF4E5; color:#B45D00;',
            approved: 'background:#E7F9ED; color:#1E7E34;',
            cancelled: 'background:#FEEFF0; color:#CF222E;',
            rejected: 'background:#FEEFF0; color:#CF222E;'
        };
        const statusMap = { pending: '核定中', approved: '已核定', cancelled: '已取消', rejected: '已退回' };

        const canCancel = (b.status === 'pending' || b.status === 'approved');

        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <span class="status-badge" style="${badgeStyle[b.status] || ''}">${statusMap[b.status] || b.status}</span>
                    <h3 style="margin-top:5px; font-size:1rem;">${b.booking_date.split('T')[0]}</h3>
                    <p style="font-size:0.85rem; color:#666;">🕐 ${b.slot_time} | 👤 ${b.display_name}</p>
                </div>
                ${canCancel ? `<button onclick="cancelMyBooking(${b.id})" style="border:1px solid #ddd; padding:4px 8px; border-radius:6px; font-size:0.75rem; background:#fff; cursor:pointer; color:#CF222E;">取消本次看診</button>` : ''}
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// =============================================
// 3. 使用者自行取消
// =============================================
async function cancelMyBooking(id) {
    if (!confirm("確定要取消此筆預約嗎？")) return;
    await fetch(`/api/bookings/user/cancel/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId: userData.userId })
    });
    fetchMyBookings();
    alert("預約已成功取消。");
}

// =============================================
// 4. 時段邏輯與提交
// =============================================
function isTooEarly(dateStr, slotTime) {
    const nowInTW = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    const target = new Date(`${dateStr.replace(/-/g, '/')} ${slotTime}:00`);
    return target.getTime() < (nowInTW.getTime() + (4 * 60 * 60 * 1000));
}

async function fetchSlots() {
    try {
        const response = await fetch(`/api/slots/${selectedDate}`);
        currentDayStatus = await response.json();
        renderSlots();
        renderCalendar();
    } catch (e) { console.error(e); }
}

function renderSlots() {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';
    if (!currentDayStatus.isDayOpen) {
        container.innerHTML = `<div style="padding: 20px; color:#CF222E; text-align:center; font-weight:600;">本日休診。</div>`;
        return;
    }
    const booked = currentDayStatus.bookings.map(b => b.slot_time);
    slotsConfig.forEach(slot => {
        const isB = booked.includes(slot.time);
        const isP = isTooEarly(selectedDate, slot.time);
        const card = document.createElement('div');
        card.className = `slot-card ${isB || isP ? 'disabled' : ''} ${selectedSlot === slot.time ? 'selected' : ''}`;
        card.innerHTML = `<span class="time">${slot.time}</span><span class="status-label">${isB ? '● 額滿' : (isP ? '● 截止' : '○ 可預約')}</span>`;
        if (!isB && !isP) card.onclick = () => { selectedSlot = slot.time; renderSlots(); };
        container.appendChild(card);
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthTitle = document.getElementById('current-month');
    if (!grid || !monthTitle) return;
    grid.innerHTML = '';
    const y = currentViewDate.getFullYear();
    const m = currentViewDate.getMonth();
    monthTitle.innerText = `${y}年${m + 1}月`;
    const startOff = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInM = new Date(y, m + 1, 0).getDate();
    for (let j = 0; j < startOff; j++) grid.appendChild(document.createElement('div'));
    const tStr = getTaiwanDateString();
    const maxD = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    maxD.setDate(maxD.getDate() + 60);
    const maxStr = getTaiwanDateString(maxD);

    for (let day = 1; day <= daysInM; day++) {
        const d = new Date(y, m, day);
        const ds = getTaiwanDateString(d);
        const isOut = (ds < tStr || ds > maxStr);
        const c = customCalendarSettings.find(s => s.target_date.split('T')[0] === ds);
        let isCl = c ? (c.is_open === 0) : ((d.getDay() === 0 || d.getDay() === 6));
        const de = document.createElement('div');
        de.className = `calendar-day ${ds === selectedDate ? 'active' : ''} ${isCl ? 'closed' : ''}`;
        if (isOut) de.style.opacity = '0.2';
        de.innerText = day;
        if (!isOut) de.onclick = () => { selectedDate = ds; selectedSlot = null; document.getElementById('selected-date').innerText = selectedDate; fetchSlots(); };
        grid.appendChild(de);
    }
}

async function submitBooking() {
    if (!selectedSlot) return alert("請選時段");
    const name = document.getElementById('patient-name').value.trim();
    if (!name) return alert("請輸入掛號人姓名");

    const phone = document.getElementById('booking-phone').value.trim();
    if (!phone) return alert("請填寫手機號碼");

    const lineIdStr = document.getElementById('booking-line-id').value.trim();

    const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            line_user_id: userData.userId,
            display_name: name,
            phone: phone,
            line_id: lineIdStr,
            picture_url: userData.pictureUrl || '',
            booking_date: selectedDate,
            slot_time: selectedSlot,
            note: document.getElementById('booking-note').value
        })
    });
    const resJ = await res.json();
    if (resJ.id) {
        alert("申請成功！請等候核定");
        location.reload();
    }
}

function changeMonth(delta) {
    currentViewDate.setMonth(currentViewDate.getMonth() + delta);
    renderCalendar();
}

async function startApp() {
    await initLiff();
    try {
        const r = await fetch('/api/admin/calendar-all');
        customCalendarSettings = await r.json();
    } catch (e) { }
    await fetchSlots();
}

startApp();
