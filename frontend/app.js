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

function getTaiwanDateString(dateObj = new Date()) {
    return dateObj.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}

let selectedDate = getTaiwanDateString();
let currentViewDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
let selectedSlot = null;
let currentDayStatus = { isDayOpen: true, bookings: [] };
let customCalendarSettings = [];

function isTooEarly(dateStr, slotTime) {
    const nowInTW = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
    const now = new Date(nowInTW);
    const target = new Date(`${dateStr.replace(/-/g, '/')} ${slotTime}:00`);
    const bufferTime = now.getTime() + (4 * 60 * 60 * 1000);
    return target.getTime() < bufferTime;
}

function isDefaultClosed(date) {
    const day = date.getDay();
    const dateStr = getTaiwanDateString(date);
    if (day === 0 || day === 6) return true;
    const nationalHolidays = ['2026-04-03', '2026-04-04', '2026-04-05', '2026-05-01', '2026-06-19'];
    return nationalHolidays.includes(dateStr);
}

function changeMonth(delta) {
    currentViewDate.setMonth(currentViewDate.getMonth() + delta);
    renderCalendar();
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
        card.innerHTML = `<span class="time">${slot.time}</span><span class="status-label">${isBooked ? '● 已額滿' : (isPast ? '● 截止' : '○ 可預約')}</span>`;
        if (!isDisabled) card.onclick = () => { selectedSlot = slot.time; renderSlots(); };
        container.appendChild(card);
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthTitle = document.getElementById('current-month');
    if (!grid || !monthTitle) return;

    grid.innerHTML = '';
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    monthTitle.innerText = `${year}年${month + 1}月`;

    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let j = 0; j < startOffset; j++) {
        grid.appendChild(document.createElement('div'));
    }

    // 取得台灣今天的字串
    const todayStr = getTaiwanDateString();
    // 取得 60 天後的字串
    const maxDateObj = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    maxDateObj.setDate(maxDateObj.getDate() + 60);
    const maxDateStr = getTaiwanDateString(maxDateObj);

    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const dateStr = getTaiwanDateString(d);

        // 使用「字串比較」來判斷範圍，最穩健
        const isPast = dateStr < todayStr;
        const isFutureTooFar = dateStr > maxDateStr;
        const isOutOfRange = isPast || isFutureTooFar;

        const custom = customCalendarSettings.find(s => s.target_date.split('T')[0] === dateStr);
        let isClosed = custom ? (custom.is_open === 0) : isDefaultClosed(d);

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';

        if (isOutOfRange) {
            dayEl.style.opacity = '0.2';
            dayEl.style.cursor = 'default';
        }

        if (dateStr === selectedDate) dayEl.classList.add('active');
        if (isClosed) dayEl.classList.add('closed');

        dayEl.innerText = day;

        // 只有非過去且在範圍內的日期可以點擊
        if (!isOutOfRange) {
            dayEl.onclick = () => {
                selectedDate = dateStr;
                selectedSlot = null;
                document.getElementById('selected-date').innerText = selectedDate;
                fetchSlots();
            };
        }
        grid.appendChild(dayEl);
    }
}

async function submitBooking() {
    if (!selectedSlot) return alert("請選擇時段");
    const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            line_user_id: 'U12345678', display_name: '使用者',
            booking_date: selectedDate, slot_time: selectedSlot,
            note: document.getElementById('booking-note').value
        })
    });
    const result = await res.json();
    if (result.id) { alert("預約成功"); location.reload(); }
}

async function startApp() {
    try {
        const res = await fetch('/api/admin/calendar-all');
        const settings = await res.json();
        customCalendarSettings = settings;
    } catch (e) { }
    document.getElementById('selected-date').innerText = selectedDate;
    await fetchSlots();
}

startApp();
