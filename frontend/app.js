const slotsConfig = [
    { time: "10:00", label: "09:00 - 10:00" },
    { time: "11:00", label: "10:00 - 11:00" },
    { time: "14:00", label: "14:00 - 15:00" },
    { time: "15:00", label: "15:00 - 16:00" },
    { time: "16:00", label: "16:00 - 17:00" },
    { time: "17:00", label: "17:00 - 18:00" },
    { time: "18:00", label: "18:00 - 19:00" },
    { time: "19:00", label: "19:00 - 20:00" },
    { time: "20:00", label: "20:00 - 21:00" },
    { time: "21:00", label: "21:00 - 22:00" }
];

let selectedDate = new Date().toISOString().split('T')[0];
let selectedSlot = null;
let currentDayStatus = { isDayOpen: true, bookings: [] };
let customCalendarSettings = []; // 儲存所有例外設定以供日曆上色

// Helper: 檢查時段是否早於「現在 + 4 小時」
function isTooEarly(dateStr, slotTime) {
    const now = new Date();
    const target = new Date(`${dateStr}T${slotTime}:00`);
    const bufferTime = now.getTime() + (4 * 60 * 60 * 1000);
    return target.getTime() < bufferTime;
}

// 預設休假判斷 (週六、週日、國定假日)
function isDefaultClosed(date) {
    const day = date.getDay();
    const dateStr = date.toISOString().split('T')[0];
    if (day === 0 || day === 6) return true;

    const nationalHolidays = ['2026-04-03', '2026-04-04', '2026-04-05', '2026-05-01'];
    return nationalHolidays.includes(dateStr);
}

// 初始化：抓取所有日曆例外設定 (為了日曆上色)
async function initCalendarData() {
    try {
        const res = await fetch('/api/admin/calendar-all');
        customCalendarSettings = await res.json();
    } catch (e) { console.error(e); }
}

// 獲取時段
async function fetchSlots() {
    try {
        const response = await fetch(`/api/slots/${selectedDate}`);
        currentDayStatus = await response.json();
        renderSlots();
        renderCalendar();
    } catch (err) {
        console.error("無法取得時段資料", err);
    }
}

function renderSlots() {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';

    if (!currentDayStatus.isDayOpen) {
        container.innerHTML = `<div style="padding: 20px; color: #cf222e; text-align: center; font-weight: 600;">本日休診，未開放預約。</div>`;
        return;
    }

    const bookedSlots = currentDayStatus.bookings.map(b => b.slot_time);

    slotsConfig.forEach(slot => {
        const isBooked = bookedSlots.includes(slot.time);
        const isPast = isTooEarly(selectedDate, slot.time);
        const isDisabled = isBooked || isPast;

        const card = document.createElement('div');
        card.className = `slot-card ${isDisabled ? 'disabled' : ''}`;
        if (selectedSlot === slot.time) card.classList.add('selected');

        let statusText = isBooked ? '● 已額滿' : (isPast ? '● 預約截止' : '○ 可預約');

        card.innerHTML = `
            <span class="time">${slot.time}</span>
            <span class="status-label">${statusText}</span>
        `;

        if (!isDisabled) {
            card.onclick = () => {
                selectedSlot = slot.time;
                renderSlots();
            };
        }
        container.appendChild(card);
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // 1. 建立星期標頭 (一 二 三 四 五 六 日)
    const header = document.createElement('div');
    header.className = 'calendar-week-header';
    ['一', '二', '三', '四', '五', '六', '日'].forEach(w => {
        const h = document.createElement('div');
        h.className = 'week-label';
        h.innerText = w;
        header.appendChild(h);
    });
    grid.parentNode.insertBefore(header, grid);
    // 防止重複插入
    if (grid.previousSibling && grid.previousSibling.className === 'calendar-week-header') {
        grid.parentNode.removeChild(grid.previousSibling);
    }

    const today = new Date();

    // 2. 計算對齊星期一的偏移量 (offset)
    // getDay 0=日, 1=一...6=六。我們希望一=索引0，所以 (day+6)%7
    const startDayOfWeek = (today.getDay() + 6) % 7;

    // 填入空白格
    for (let j = 0; j < startDayOfWeek; j++) {
        const empty = document.createElement('div');
        grid.appendChild(empty);
    }

    // 3. 顯示 60 天
    for (let i = 0; i < 60; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const isFirstDayOfMonth = d.getDate() === 1;

        // 判斷是否為休診日
        const custom = customCalendarSettings.find(s => s.target_date.split('T')[0] === dateStr);
        let isClosed = false;
        if (custom) {
            isClosed = (custom.is_open === 0);
        } else {
            isClosed = isDefaultClosed(d);
        }

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (dateStr === selectedDate) dayEl.classList.add('active');
        if (isClosed) dayEl.classList.add('closed'); // 休診顯示紅色 (CSS 控制)

        const monthLabel = isFirstDayOfMonth ? `<span style="font-size: 10px; display: block; margin-bottom: -4px;">${d.getMonth() + 1}月</span>` : '';
        dayEl.innerHTML = `${monthLabel}${d.getDate()}`;

        dayEl.onclick = () => {
            selectedDate = dateStr;
            selectedSlot = null;
            document.getElementById('selected-date').innerText = selectedDate;
            fetchSlots();
        };
        grid.appendChild(dayEl);
    }
}

async function submitBooking() {
    if (!selectedSlot) return alert("請先選擇一個預約時段！");
    const bookingData = {
        line_user_id: 'U12345678', // 模擬
        display_name: '測試用戶',
        booking_date: selectedDate,
        slot_time: selectedSlot,
        note: document.getElementById('booking-note').value
    };

    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });
        const result = await response.json();
        if (result.id) {
            alert(`預約申請已成功送出！`);
            location.reload();
        } else {
            alert("預約失敗：" + (result.error || "未知錯誤"));
        }
    } catch (err) { alert("提交失敗"); }
}

async function startApp() {
    await initCalendarData(); // 先抓例外設定
    await fetchSlots();       // 再抓今日時段
    renderCalendar();
}

startApp();
