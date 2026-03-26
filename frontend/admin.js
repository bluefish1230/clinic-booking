let allBookings = [
    { id: 101, name: "張三", date: "2026-03-27", slot: "10:00", note: "第一次預約", status: "pending" },
    { id: 102, name: "李四", date: "2026-03-27", slot: "14:00", note: "希望準時", status: "approved" },
];

function fetchBookings() {
    renderLists();
}

function renderLists() {
    const pendingContainer = document.getElementById("pending-list");
    const allContainer = document.getElementById("all-list");

    pendingContainer.innerHTML = '';
    allContainer.innerHTML = '';

    allBookings.forEach(booking => {
        const item = document.createElement('div');
        item.className = 'booking-item';
        item.innerHTML = `
      <div class="info">
          <span class="user-name">${booking.name}</span>
          <span class="booking-detail">${booking.date} | ${booking.slot}</span>
          <p class="note">備註：${booking.note}</p>
      </div>
      <div class="actions">
          ${booking.status === 'pending' ? `
            <button class="btn-approve" onclick="updateStatus(${booking.id}, 'approved')">核定</button>
            <button class="btn-reject" onclick="updateStatus(${booking.id}, 'rejected')">退回</button>
          ` : `
            <span class="badge ${booking.status === 'approved' ? 'badge-approved' : ''}">${booking.status === 'approved' ? '已核准' : booking.status === 'rejected' ? '已退回' : '已取消'}</span>
            <button onclick="deleteBooking(${booking.id})" style="font-size: 0.7rem; border:none; background:none; color:red; cursor:pointer;">刪除</button>
          `}
      </div>
    `;

        if (booking.status === 'pending') {
            pendingContainer.appendChild(item);
        } else {
            allContainer.appendChild(item);
        }
    });
}

function updateStatus(id, newStatus) {
    const booking = allBookings.find(b => b.id === id);
    if (booking) {
        booking.status = newStatus;
        renderLists();
        console.log(`預約 ID ${id} 狀態已更新為 ${newStatus}`);
        // 在此與後端 API 對接，並發送推播通知給使用者
    }
}

function adminCreateBooking() {
    const name = document.getElementById('manual-name').value;
    const date = document.getElementById('manual-date').value;
    const slot = document.getElementById('manual-slot').value;

    if (!name || !date || !slot) {
        alert("請填寫所有欄位！");
        return;
    }

    const newBooking = {
        id: Date.now(),
        name: name,
        date: date,
        slot: slot,
        note: "管理員手動新增",
        status: "approved" // 管理員新增的通常直接核准
    };

    allBookings.push(newBooking);
    renderLists();
    alert("已成功手動新增預約記錄。");
}

function deleteBooking(id) {
    allBookings = allBookings.filter(b => b.id !== id);
    renderLists();
}

// 初始加載
fetchBookings();
