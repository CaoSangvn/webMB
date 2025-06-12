// app/static/js/admin/script_quan_ly_dat_cho.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Booking Management Script Loaded - API Integrated and Corrected!");

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

    let currentSortColumn = 'created_at_formatted'; // Mặc định sắp xếp theo ngày tạo
    let currentSortDirection = 'desc'; // Mặc định giảm dần (mới nhất lên đầu)

    const statusMapping = {
        "confirmed": { text: "Đã xác nhận", class: "status-confirmed" },
        "pending_payment": { text: "Chờ thanh toán", class: "status-pending_payment" },
        "payment_received": { text: "Đã thanh toán", class: "status-payment_received" },
        "cancelled_by_user": { text: "Khách hủy", class: "status-cancelled_by_user" },
        "cancelled_by_airline": { text: "Hãng hủy", class: "status-cancelled_by_airline" },
        "completed": { text: "Đã hoàn thành", class: "status-completed" },
        "no_show": { text: "Không đến", class: "status-no_show" },
        "changed": "Đã thay đổi",
        "paid": "Đã thanh toán"
    };

    function formatCurrency(amount) {
        return (amount || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    }

    function updateSortIcons() {
        document.querySelectorAll('#bookingsTable th[data-sort-by]').forEach(th => {
            const icon = th.querySelector('i.fas');
            if (!icon) return;
            icon.classList.remove('fa-sort-up', 'fa-sort-down');
            
            if (th.dataset.sortBy === currentSortColumn) {
                icon.classList.add(currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            } else {
                icon.classList.add('fa-sort');
            }
        });
    }
    
    function sortData(dataArray, column, direction) {
        if (!column) return dataArray;
        const sortedArray = [...dataArray]; 
        sortedArray.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;
            if (typeof valA === 'string') {
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (typeof valA === 'number') {
                return direction === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
        return sortedArray;
    }

    function applyFiltersAndSort() {
        let filteredBookings = [...allBookingsData];

        // Áp dụng bộ lọc
        const searchTerm = bookingSearchInput ? bookingSearchInput.value.toLowerCase().trim() : '';
        const statusTerm = bookingStatusFilter ? bookingStatusFilter.value : '';
        const dateTerm = flightDateFilter ? flightDateFilter.value : '';

        if (searchTerm) {
            filteredBookings = filteredBookings.filter(booking =>
                (booking.pnr || booking.booking_code || '').toLowerCase().includes(searchTerm) ||
                (booking.passenger_name || '').toLowerCase().includes(searchTerm) ||
                (booking.email || '').toLowerCase().includes(searchTerm)
            );
        }
        if (statusTerm) {
            filteredBookings = filteredBookings.filter(booking => booking.booking_status === statusTerm);
        }
        if (dateTerm) {
            filteredBookings = filteredBookings.filter(booking => booking.flight_date === dateTerm);
        }

        // Áp dụng sắp xếp
        const sortedAndFiltered = sortData(filteredBookings, currentSortColumn, currentSortDirection);
        renderBookingsTable(sortedAndFiltered);
    }

    async function fetchBookings() {
        console.log(`Fetching all bookings from API...`);
        try {
            const response = await fetch('/admin/api/bookings');
            const data = await response.json();
            if (data.success && Array.isArray(data.bookings)) {
                allBookingsData = data.bookings;
                applyFiltersAndSort(); // Áp dụng sắp xếp mặc định và render
                updateSortIcons(); // Cập nhật icon cho cột sắp xếp mặc định
            } else {
                if(bookingsTableBody) bookingsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">${data.message || 'Không tải được dữ liệu đặt chỗ.'}</td></tr>`;
            }
        } catch (error) {
            if(bookingsTableBody) bookingsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Lỗi kết nối máy chủ.</td></tr>`;
            console.error("Error fetching bookings:", error);
        }
    }

    function addSortEventListeners() {
        document.querySelectorAll('#bookingsTable th[data-sort-by]').forEach(headerCell => {
            headerCell.addEventListener('click', () => {
                const sortKey = headerCell.dataset.sortBy;
                if (currentSortColumn === sortKey) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = sortKey;
                    currentSortDirection = 'desc'; // Mặc định giảm dần khi nhấn cột mới
                }
                updateSortIcons(headerCell); // Cập nhật tất cả icon
                applyFiltersAndSort(); // Sắp xếp và render lại bảng
            });
        });
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
                    <button class="btn btn-sm btn-delete-booking" data-booking-id="${booking.booking_id}" data-pnr="${booking.pnr}"><i class="fas fa-trash"></i> Xóa</button>
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
        
        bookingsTableBody.querySelectorAll('.btn-delete-booking').forEach(btn => {
            btn.addEventListener('click', async function() {
                const bookingId = this.dataset.bookingId;
                const pnr = this.dataset.pnr;

                if (confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN đặt chỗ có mã ${pnr} không?`)) {
                    try {
                        const response = await fetch(`/admin/api/bookings/${bookingId}`, {
                            method: 'DELETE',
                        });
                        const result = await response.json();
                        alert(result.message);
                        if (result.success) {
                            fetchBookings(bookingSearchInput.value, bookingStatusFilter.value, flightDateFilter.value);
                        }
                    } catch (error) {
                        console.error("Lỗi khi xóa đặt chỗ:", error);
                        alert("Lỗi kết nối khi thực hiện yêu cầu xóa.");
                    }
                }
            });
        });
    }

    async function openBookingDetailModal(bookingId) {
        if (!bookingDetailModal || !bookingDetailContent || !bookingDetailModalTitleSpan) return;

        bookingDetailContent.innerHTML = '<p>Đang tải chi tiết...</p>';
        bookingDetailModal.style.display = 'flex';

        try {
            const response = await fetch(`/admin/api/bookings/${bookingId}`);
            const result = await response.json();

            if (response.ok && result.success && result.booking) {
                const booking = result.booking;
                bookingDetailModalTitleSpan.textContent = booking.pnr || booking.booking_code;

                let passengerList = '<ul>';
                if (booking.passengers && booking.passengers.length > 0) {
                    booking.passengers.forEach(p => {
                        passengerList += `<li>${p.full_name || 'N/A'} (${p.passenger_type || 'N/A'})</li>`;
                    });
                } else {
                    passengerList += '<li>Không có thông tin hành khách.</li>';
                }
                passengerList += '</ul>';

                bookingDetailContent.innerHTML = `
                    <h4>Thông tin Chuyến bay</h4>
                    <p><strong>Hành trình:</strong> ${booking.departure_iata || ''} → ${booking.arrival_iata || ''}</p>
                    <p><strong>Khởi hành:</strong> ${booking.departure_datetime_formatted || booking.departure_time}</p>
                    <p><strong>Hạ cánh:</strong> ${booking.arrival_datetime_formatted || booking.arrival_time}</p>
                    <p><strong>Số hiệu:</strong> ${booking.flight_number || 'N/A'}</p>
                    
                    <h4>Thông tin Đặt chỗ</h4>
                    <p><strong>Trạng thái:</strong> ${statusMapping[booking.booking_status]?.text || booking.booking_status}</p>
                    <p><strong>Trạng thái thanh toán:</strong> ${booking.payment_status || 'N/A'}</p>
                    <p><strong>Tổng tiền:</strong> ${formatCurrency(booking.total_amount)}</p>
                    <p><strong>Hạng ghế:</strong> ${booking.seat_class_booked || 'N/A'}</p>

                    <h4>Hành khách</h4>
                    ${passengerList}

                    <h4>Ghi chú</h4>
                    <pre style="white-space: pre-wrap; background: #f4f4f4; padding: 10px; border-radius: 4px;">${booking.admin_notes || 'Không có ghi chú.'}</pre>
                `;
                
                if (editBookingStatusBtn) {
                     editBookingStatusBtn.dataset.bookingId = booking.id;
                }

            } else {
                bookingDetailContent.innerHTML = `<p class="error-message">${result.message || "Không thể tải chi tiết đặt chỗ."}</p>`;
            }
        } catch (error) {
            console.error("Lỗi khi tải chi tiết đặt chỗ:", error);
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
            } else {
                alert("Không tìm thấy thông tin đặt chỗ để sửa. Vui lòng làm mới trang.");
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
                const response = await fetch(`/admin/api/bookings/${bookingId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    alert(result.message || "Cập nhật thành công!");
                    closeModal(editBookingStatusModal);
                    fetchBookings(bookingSearchInput.value, bookingStatusFilter.value, flightDateFilter.value);
                } else {
                    alert("Lỗi: " + (result.message || "Không thể cập nhật."));
                }
            } catch (error) {
                console.error("Lỗi khi cập nhật trạng thái:", error);
                alert("Lỗi kết nối khi cập nhật.");
            }
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
    if (applyBookingFilterBtn) {
        applyBookingFilterBtn.addEventListener('click', applyFiltersAndSort);
    }
    if (bookingSearchInput) {
        bookingSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') applyFiltersAndSort();
        });
    }
    addSortEventListeners(); // Gắn listener cho sắp xếp
    fetchBookings();
});