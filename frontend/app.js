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

// Helper: 檢查時段是否早於「現在 + 4 小時」
function isTooEarly(dateStr, slotTime) {
    const now = new Date();
    const target = new Date(`${dateStr}T${slotTime}:00`);
    const bufferTime = now.getTime() + (4 * 60 * 60 * 1000); // 現在 + 4 小時
    return target.getTime() < bufferTime;
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
        // 規則 1: 檢查是否已被他人預約
        const isBooked = bookedSlots.includes(slot.time);

        // 規則 2: 檢查是否符合「現在時間 + 4 小時」緩衝
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

    const today = new Date();
    // 規則 3: 顯示 60 天內 (約 2 個月) 的日曆
    for (let i = 0; i < 60; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.getDay();
        const isFirstDayOfMonth = d.getDate() === 1;

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (dateStr === selectedDate) dayEl.classList.add('active');
        if (dayOfWeek === 0 || dayOfWeek === 6) dayEl.style.color = '#cf222e';

        // 如果是月份的第一天，顯示月份名稱以便辨識
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

    // LINE 使用者資訊模擬 (正式環境會從 liff.getProfile 取得)
    const lineUser = { line_user_id: 'U12345678', display_name: '測試用戶' };

    const bookingData = {
        line_user_id: lineUser.line_user_id,
        display_name: lineUser.display_name,
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
            alert(`預約申請已成功送出！\n日期：${selectedDate}\n時段：${selectedSlot}\n請等候審核。`);
            location.reload();
        } else {
            alert("預約失敗：" + (result.error || "未知錯誤"));
        }
    } catch (err) {
        alert("提交失敗，請檢查網路連線。");
    }
}

fetchSlots();
renderCalendar();
