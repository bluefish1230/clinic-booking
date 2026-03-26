const slotsConfig = [
    { time: "10:00", label: "10:00 - 11:00" },
    { time: "11:00", label: "11:00 - 12:00" },
    // 12:00 - 14:00 休息時間
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

// 初始化 LIFF (如果有的話)
async function initLiff() {
    try {
        await liff.init({ liffId: "您的_LIFF_ID" });
        if (!liff.isLoggedIn()) {
            liff.login();
        }
    } catch (err) {
        console.log("LIFF 初始化失敗", err);
    }
}

// 渲染時段
function renderSlots() {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';

    slotsConfig.forEach(slot => {
        // 模擬已預約狀態 (Mock Data)
        const isBooked = Math.random() > 0.8;

        const card = document.createElement('div');
        card.className = `slot-card ${isBooked ? 'disabled' : ''}`;
        if (selectedSlot === slot.time) card.classList.add('selected');

        card.innerHTML = `
      <span class="time">${slot.time}</span>
      <span class="status-label">${isBooked ? '● 已額滿' : '○ 可預約'}</span>
    `;

        if (!isBooked) {
            card.onclick = () => selectSlot(slot.time);
        }
        container.appendChild(card);
    });
}

// 選擇時段
function selectSlot(time) {
    selectedSlot = time;
    renderSlots();
}

// 渲染日曆 (簡化版)
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    // 保持標籤
    const labels = grid.querySelectorAll('.calendar-day-label');
    grid.innerHTML = '';
    labels.forEach(l => grid.appendChild(l));

    const today = new Date();
    for (let i = 0; i < 21; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (dateStr === selectedDate) dayEl.classList.add('active');
        dayEl.innerText = d.getDate();

        dayEl.onclick = () => {
            selectedDate = dateStr;
            document.getElementById('selected-date').innerText = selectedDate;
            renderCalendar();
            renderSlots();
        };
        grid.appendChild(dayEl);
    }
}

// 提交預約
function submitBooking() {
    if (!selectedSlot) {
        alert("請先選擇一個預約時段！");
        return;
    }
    const note = document.getElementById('booking-note').value;
    const bookingData = {
        date: selectedDate,
        slot: selectedSlot,
        note: note,
        status: 'pending'
    };

    console.log("提交預約：", bookingData);
    alert(`預約申請已送出！\n日期：${selectedDate}\n時段：${selectedSlot}\n請等候管理員核定。`);
}

// 初始執行
renderCalendar();
renderSlots();
// initLiff();
