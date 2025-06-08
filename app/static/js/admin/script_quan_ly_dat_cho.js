// app/static/js/admin/script_quan_ly_dat_cho.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Booking Management Script Loaded - API Integrated!");

    const bookingsTableBody = document.getElementById('bookingsTableBody');
    const bookingSearchInput = document.getElementById('bookingSearchInput');
    const bookingStatusFilter = document.getElementById('bookingStatusFilter');
    const flightDateFilter = document.getElementById('flightDateFilter');
    const applyBookingFilterBtn = document.getElementById('applyBookingFilterBtn');

    const bookingDetailModal = document.getElementById('bookingDetailModal');
    const closeBookingDetailModalBtn = document.getElementById('closeBookingDetailModalBtn');
    const bookingDetailModalTitleSpan = document.getElementById('detailPnr'); 
    const bookingDetailContent = document.getElementById('bookingDetailContent');
    const printBookingBtn = document.getElementById('printBookingBtn');
    const editBookingStatusBtn = document.getElementById('editBookingStatusBtn');

    const editBookingStatusModal = document.getElementById('editBookingStatusModal');
    const closeEditStatusModalBtn = document.getElementById('closeEditStatusModalBtn');
    const editStatusPnrDisplay = document.getElementById('editStatusPnr');
    const editBookingStatusForm = document.getElementById('editBookingStatusForm');
    const newBookingStatusSelect = document.getElementById('newBookingStatus');
    const adminNotesTextarea = document.getElementById('adminNotes');
    const cancelEditStatusBtn = document.getElementById('cancelEditStatusBtn');
    const hiddenEditBookingIdInput = document.getElementById('editBookingId');

    let allBookingsData = [];
    let currentEditingBookingId = null; 

    const statusMapping = {
        "confirmed": { text: "Đã xác nhận", class: "status-confirmed" },
        "pending_payment": { text: "Chờ thanh toán", class: "status-pending_payment" },
        "payment_received": { text: "Đã thanh toán", class: "status-payment_received" },
        "cancelled_by_user": { text: "Khách hủy", class: "status-cancelled_by_user" },
        "cancelled_by_airline": { text: "Admin hủy", class: "status-cancelled_by_airline" },
        "completed": { text: "Đã hoàn thành", class: "status-completed" },
        "no_show": { text: "Khách không đến", class: "status-no_show" }
    };

    function formatCurrency(amount) {
        return (amount || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    }

    async function fetchBookings(searchTerm = '', statusTerm = '', dateTerm = '') {
        let apiUrl = `/admin/api/bookings?search=${encodeURIComponent(searchTerm)}&status=${encodeURIComponent(statusTerm)}&flightDate=${encodeURIComponent(dateTerm)}`;
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            if (data.success) {
                allBookingsData = data.bookings;
                renderBookingsTable(allBookingsData);
            } else {
                bookingsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">${data.message || 'Lỗi tải dữ liệu.'}</td></tr>`;
            }
        } catch (error) {
            bookingsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Lỗi kết nối máy chủ.</td></tr>`;
        }
    }

    function renderBookingsTable(bookingsToRender) {
        if (!bookingsTableBody) return;
        bookingsTableBody.innerHTML = ''; 
        if (!bookingsToRender || bookingsToRender.length === 0) {
            bookingsTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Không có đặt chỗ nào.</td></tr>';
            return;
        }

        bookingsToRender.forEach(booking => {
            const row = bookingsTableBody.insertRow();
            const statusInfo = statusMapping[booking.booking_status] || { text: booking.booking_status, class: '' };
            
            row.innerHTML = `
                <td>${booking.pnr || 'N/A'}</td>
                <td>${booking.passenger_name || 'N/A'}</td>
                <td>${booking.email || 'N/A'}</td>
                <td>${booking.itinerary || 'N/A'}</td>
                <td>${booking.flight_date || 'N/A'}</td>
                <td>${formatCurrency(booking.total_amount)}</td>
                <td><span class="status-booking ${statusInfo.class}">${statusInfo.text}</span></td>
                <td>${booking.created_at_formatted || 'N/A'}</td>
                <td class="btn-action-group">
                    <button class="btn btn-sm btn-view-detail" data-booking-id="${booking.booking_id}"><i class="fas fa-eye"></i> Xem</button>
                    <button class="btn btn-sm btn-edit-booking" data-booking-id="${booking.booking_id}" data-pnr="${booking.pnr}" data-current-status="${booking.booking_status}"><i class="fas fa-edit"></i> Sửa TT</button>
                </td>
            `;
        });
        attachActionListenersToBookingTable();
    }

    function attachActionListenersToBookingTable() {
        if (!bookingsTableBody) return;
        
        bookingsTableBody.querySelectorAll('.btn-view-detail').forEach(btn => {
            btn.addEventListener('click', function() {
                openBookingDetailModal(this.dataset.bookingId);
            });
        });
        bookingsTableBody.querySelectorAll('.btn-edit-booking').forEach(btn => {
            btn.addEventListener('click', function() {
                openEditBookingStatusModal(this.dataset.bookingId, this.dataset.pnr, this.dataset.currentStatus);
            });
        });
    }

    async function openBookingDetailModal(bookingId) {
        if (!bookingDetailModal || !bookingDetailContent || !bookingDetailModalTitleSpan) return;
        
        bookingDetailContent.innerHTML = '<p>Đang tải chi tiết...</p>';
        bookingDetailModal.style.display = 'flex';
        
        try {
            const response = await fetch(`/api/bookings/${bookingId}`);
            const result = await response.json();
            if (response.ok && result.success) {
                const booking = result.booking; 
                bookingDetailModalTitleSpan.textContent = booking.pnr;
                // (Phần render chi tiết vào bookingDetailContent giữ nguyên như file của bạn)
                // ...
                if (editBookingStatusBtn) editBookingStatusBtn.dataset.bookingId = booking.id; 
            } else {
                bookingDetailContent.innerHTML = `<p class="error-message">${result.message || "Không thể tải chi tiết."}</p>`;
            }
        } catch (error) {
            bookingDetailContent.innerHTML = `<p class="error-message">Lỗi kết nối.</p>`;
        }
    }

    function openEditBookingStatusModal(bookingId, pnr, currentStatus) {
        if (!editBookingStatusModal) return;
        
        currentEditingBookingId = bookingId; 
        if (editStatusPnrDisplay) editStatusPnrDisplay.textContent = pnr;
        if (hiddenEditBookingIdInput) hiddenEditBookingIdInput.value = bookingId;
        if (newBookingStatusSelect) newBookingStatusSelect.value = currentStatus;
        if (adminNotesTextarea) adminNotesTextarea.value = ''; 
        editBookingStatusModal.style.display = 'flex';
    }

    function closeModal(modalElement) {
        if (modalElement) modalElement.style.display = 'none';
    }

    if (closeBookingDetailModalBtn) closeBookingDetailModalBtn.addEventListener('click', () => closeModal(bookingDetailModal));
    if (closeEditStatusModalBtn) closeEditStatusModalBtn.addEventListener('click', () => closeModal(editBookingStatusModal));
    if (cancelEditStatusBtn) cancelEditStatusBtn.addEventListener('click', () => closeModal(editBookingStatusModal));
    
    window.addEventListener('click', function(event) {
        if (event.target == bookingDetailModal) closeModal(bookingDetailModal);
        if (event.target == editBookingStatusModal) closeModal(editBookingStatusModal);
    });
    
    if (editBookingStatusBtn) { 
        editBookingStatusBtn.addEventListener('click', function() {
            const bookingId = this.dataset.bookingId;
            const bookingToEdit = allBookingsData.find(b => b.booking_id == bookingId);
            if (bookingToEdit) {
                closeModal(bookingDetailModal);
                openEditBookingStatusModal(bookingId, bookingToEdit.pnr, bookingToEdit.booking_status);
            }
        });
    }

    if (editBookingStatusForm) {
        editBookingStatusForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const bookingId = hiddenEditBookingIdInput.value;
            const newStatus = newBookingStatusSelect.value;
            const notes = adminNotesTextarea.value.trim();

            const payload = { newStatus: newStatus };
            if (notes) payload.adminNotes = notes;

            try {
                const response = await fetch(`/api/bookings/${bookingId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    alert(result.message);
                    fetchBookings(bookingSearchInput.value, bookingStatusFilter.value, flightDateFilter.value);
                } else {
                    alert("Lỗi: " + result.message);
                }
            } catch (error) {
                alert("Lỗi kết nối khi cập nhật.");
            }
            closeModal(editBookingStatusModal);
        });
    }
    
    function filterAndSearchBookings() {
        fetchBookings(
            bookingSearchInput.value.trim(),
            bookingStatusFilter.value,
            flightDateFilter.value
        ); 
    }

    if (applyBookingFilterBtn) applyBookingFilterBtn.addEventListener('click', filterAndSearchBookings);
    
    fetchBookings();
});