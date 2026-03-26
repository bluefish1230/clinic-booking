// =============================================
//  診所預約系統 - 管理後台邏輯
//  (目前使用假資料，之後可接 API)
// =============================================

let allBookings = [
    { id: 101, name: "張三", date: "2026-03-27", slot: "10:00", note: "第一次預約", status: "pending" },
    { id: 102, name: "李四", date: "2026-03-27", slot: "14:00", note: "希望準時", status: "approved" },
    { id: 103, name: "王小明", date: "2026-03-28", slot: "11:00", note: "無", status: "rejected" },
];

// =============================================
// 主要渲染函式
// =============================================
function fetchBookings() {
    renderLists();
}

function renderLists() {
    const pendingContainer = document.getElementById("pending-list");
    const allContainer = document.getElementById("all-list");

    pendingContainer.innerHTML = '';
    allContainer.innerHTML = '';

    const pendingBookings = allBookings.filter(b => b.status === 'pending');
    const otherBookings = allBookings.filter(b => b.status !== 'pending');

    // 更新 Tab 計數 Badge
    document.getElementById('pending-count').textContent = pendingBookings.length;
    document.getElementById('all-count').textContent = otherBookings.length;
    document.getElementById('pending-header-count').textContent = `${pendingBookings.length} 筆待審核預約`;
    document.getElementById('all-header-count').textContent = `${otherBookings.length} 筆預約紀錄`;

    // 渲染待審核
    if (pendingBookings.length === 0) {
        pendingContainer.innerHTML = createEmptyState('目前無待審核的預約', '所有預約已處理完畢');
    } else {
        pendingBookings.forEach(b => pendingContainer.appendChild(createBookingItem(b)));
    }

    // 渲染全部 (非待審核)
    if (otherBookings.length === 0) {
        allContainer.innerHTML = createEmptyState('目前無已確認的預約', '核准後的預約將顯示於此');
    } else {
        otherBookings.forEach(b => allContainer.appendChild(createBookingItem(b)));
    }
}

// =============================================
// 建立單一預約清單項目 DOM
// =============================================
function createBookingItem(booking) {
    const item = document.createElement('div');
    item.className = 'booking-item';

    const badgeMap = {
        pending: { cls: 'badge-pending', text: '待審核' },
        approved: { cls: 'badge-approved', text: '已核准' },
        rejected: { cls: 'badge-rejected', text: '已退回' },
        cancelled: { cls: 'badge-rejected', text: '已取消' },
    };
    const badge = badgeMap[booking.status] || { cls: '', text: booking.status };

    // 動作按鈕
    let actionsHtml = '';
    if (booking.status === 'pending') {
        actionsHtml = `
            <button class="btn-approve" onclick="updateStatus(${booking.id}, 'approved')">✓ 核准</button>
            <button class="btn-reject"  onclick="updateStatus(${booking.id}, 'rejected')">✗ 退回</button>
        `;
    } else {
        actionsHtml = `
            <button class="btn-delete" onclick="deleteBooking(${booking.id})" title="刪除此筆記錄">🗑 刪除</button>
        `;
    }

    item.innerHTML = `
        <div class="info">
            <span class="user-name">
                <svg viewBox="0 0 16 16" width="14" fill="#57606a" style="flex-shrink:0">
                    <path d="M10.5 5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm.061 3.073a4 4 0 10-5.123 0 6.004 6.004 0 00-3.431 5.142.75.75 0 001.498.07 4.5 4.5 0 018.99 0 .75.75 0 101.498-.07 6.005 6.005 0 00-3.432-5.142z"/>
                </svg>
                ${booking.name}
                <span class="badge ${badge.cls}">${badge.text}</span>
            </span>
            <span class="booking-detail">
                📅 ${booking.date} &nbsp;|&nbsp; 🕐 ${booking.slot}
            </span>
            ${booking.note ? `<span class="note">💬 ${booking.note}</span>` : ''}
        </div>
        <div class="actions">
            ${actionsHtml}
        </div>
    `;
    return item;
}

// =============================================
// 空白狀態 HTML
// =============================================
function createEmptyState(title, subtitle) {
    return `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" width="40" fill="#57606a"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <p>${title}</p>
            <small>${subtitle}</small>
        </div>
    `;
}

// =============================================
// 更新狀態
// =============================================
function updateStatus(id, newStatus) {
    const booking = allBookings.find(b => b.id === id);
    if (booking) {
        booking.status = newStatus;
        renderLists();
    }
}

// =============================================
// 管理員手動新增
// =============================================
function adminCreateBooking() {
    const name = document.getElementById('manual-name').value.trim();
    const date = document.getElementById('manual-date').value;
    const slot = document.getElementById('manual-slot').value;

    if (!name || !date || !slot) {
        alert("請填寫所有欄位！");
        return;
    }

    const newBooking = {
        id: Date.now(),
        name,
        date,
        slot,
        note: "管理員手動新增",
        status: "approved"
    };

    allBookings.push(newBooking);
    renderLists();

    // 清空表單
    document.getElementById('manual-name').value = '';
    document.getElementById('manual-date').value = '';

    // 切回全部預約 Tab
    document.querySelectorAll('.gh-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.gh-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-all').classList.add('active');
    document.getElementById('panel-all').classList.add('active');
}

// =============================================
// 刪除
// =============================================
function deleteBooking(id) {
    if (!confirm("確定要刪除此筆預約紀錄嗎？")) return;
    allBookings = allBookings.filter(b => b.id !== id);
    renderLists();
}

// 初始載入
fetchBookings();
