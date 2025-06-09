// app/static/js/my_flights_script.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("My Flights Client Script Loaded - API Integrated!");

    const lookupForm = document.getElementById('my-flights-lookup-form');
    const flightDetailsSection = document.getElementById('flight-details-section-vj');
    const lookupErrorMsg = document.getElementById('lookup-error-msg-vj');
    const myBookingsListContainer = document.getElementById('my-bookings-list-container-vj');

    const serviceModal = document.getElementById('service-modal-vj');
    const closeServiceModalBtn = document.getElementById('close-service-modal-btn-vj');
    const addServiceForm = document.getElementById('add-service-form-vj');
    
    const mealOptionsContainer = document.getElementById('modal-meal-options-container');
    const mealFeeDisplay = document.getElementById('modal-meal-fee-display-vj');
    const totalServiceCostDisplay = document.getElementById('modal-total-service-cost-display-vj');

    let currentBookingDataForCard = null;
    let allUserBookings = [];

    const statusMapping = {
        "confirmed": { text: "Đã xác nhận", class: "status-confirmed-vj" },
        "pending_payment": { text: "Chờ thanh toán", class: "status-pending-vj" },
        "payment_received": { text: "Đã thanh toán", class: "status-paid-vj" },
        "cancelled_by_user": { text: "Đã hủy", class: "status-cancelled-vj" },
        "cancelled_by_airline": { text: "Chuyến bay bị hủy", class: "status-cancelled-vj" },
        "completed": { text: "Đã hoàn thành", class: "status-completed-vj" },
        "no_show": { text: "Không có mặt", class: "status-no-show-vj" }
    };

    function formatCurrency(amount) {
        return (amount || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    }

    function renderFlightCard(booking) {
        if (!flightDetailsSection || !booking) {
            if (flightDetailsSection) flightDetailsSection.innerHTML = '<p class="error-message-vj">Không thể hiển thị chi tiết đặt chỗ.</p>';
            return;
        }
        currentBookingDataForCard = booking;

        let passengerHTML = booking.passengers && booking.passengers.length > 0
            ? booking.passengers.map(p => `<li>${p.full_name} (${p.passenger_type || 'adult'})</li>`).join('')
            : '<li>Không có thông tin hành khách.</li>';

        const statusInfo = statusMapping[booking.booking_status] || { text: booking.booking_status || 'N/A', class: 'status-pending-vj' };
        
        let actionsHTML = '';
        if (booking.booking_status === 'confirmed' || booking.booking_status === 'pending_payment' || booking.booking_status === 'payment_received') {
            actionsHTML = `
                <div class="flight-actions-vj">
                    <button class="action-btn-vj primary-btn-vj online-checkin-btn-vj"><i class="fas fa-check-circle"></i>Làm thủ tục Online</button>
                    <button class="action-btn-vj secondary-btn-vj add-service-btn-show-vj"><i class="fas fa-concierge-bell"></i>Thêm Dịch vụ</button>
                    <button class="action-btn-vj cancel-booking-btn-vj" style="background-color: #dc3545; color: white;"><i class="fas fa-times-circle"></i>Hủy chuyến</button>
                </div>
            `;
        }

        const cardHTML = `
        <div class="flight-card-vj" data-booking-id="${booking.booking_id}" data-pnr="${booking.pnr}">
            <div class="card-header-vj">
                <h2>Mã đặt chỗ: <span>${booking.pnr}</span></h2>
                <span class="status-vj ${statusInfo.class}">${statusInfo.text}</span>
            </div>
            <div class="flight-segment-vj">
                 <div class="segment-header-vj"><h4>Chuyến bay</h4><div class="flight-number-vj">Số hiệu: <span>${booking.flight_number || 'N/A'}</span></div></div>
                 <div class="flight-route-vj">
                    <div class="city-point-vj"><span class="city-name-vj">${booking.departure_city || 'N/A'}</span><span class="city-code-vj">${booking.departure_iata || ''}</span></div>
                    <div class="flight-icon-container-vj"><span class="flight-icon-vj">✈</span><span class="flight-duration-vj">${booking.duration_formatted || 'N/A'}</span></div>
                    <div class="city-point-vj"><span class="city-name-vj">${booking.arrival_city || 'N/A'}</span><span class="city-code-vj">${booking.arrival_iata || ''}</span></div>
                </div>
                <div class="flight-timings-vj"><p>Khởi hành: <strong>${booking.departure_datetime_formatted || 'N/A'}</strong></p><p>Đến nơi: <strong>${booking.arrival_datetime_formatted || 'N/A'}</strong></p></div>
                <p>Hạng ghế: <span>${booking.seat_class_booked || 'N/A'}</span></p>
            </div>
            <div class="passengers-info-vj"><h4>Thông tin hành khách</h4><ul>${passengerHTML}</ul></div>
            <div class="fare-details-vj">
                <h4>Chi tiết giá vé</h4>
                <div class="fare-row-vj"><span class="fare-label-vj">Giá vé cơ bản:</span> <span class="fare-value-vj">${formatCurrency(booking.base_fare)}</span></div>
                <div class="fare-row-vj"><span class="fare-label-vj">Dịch vụ cộng thêm:</span> <span class="fare-value-vj">${formatCurrency(booking.ancillary_services_total)}</span></div>
                <div class="fare-row-vj"><span class="fare-label-vj">Giảm giá:</span> <span class="fare-value-vj">-${formatCurrency(booking.discount_applied)}</span></div>
                <hr class="fare-divider-vj">
                <div class="fare-row-vj total-fare-vj"><strong>Tổng cộng:</strong> <strong>${formatCurrency(booking.total_amount)}</strong></div>
                <p class="payment-status-info-vj">Trạng thái thanh toán: <span class="${booking.payment_status === 'paid' ? 'status-paid-vj' : ''}">${booking.payment_status || 'N/A'}</span></p>
            </div>
            ${actionsHTML}
        </div>
        <button id="back-to-list-btn" class="action-btn-vj secondary-btn-vj" style="margin-top: 15px;"><i class="fas fa-arrow-left"></i> Quay lại danh sách</button>
        `;
        flightDetailsSection.innerHTML = cardHTML;
        flightDetailsSection.style.display = "block";
        if (myBookingsListContainer) myBookingsListContainer.style.display = "none";
        attachActionListenersToCard(booking);
    }

    function renderMyBookingsList(bookings) {
        if (!myBookingsListContainer) return;
        myBookingsListContainer.innerHTML = '';
        if(flightDetailsSection) flightDetailsSection.style.display = "none";

        if (!bookings || bookings.length === 0) {
            myBookingsListContainer.innerHTML = "<p>Bạn chưa có đặt chỗ nào.</p>";
        } else {
            const listTitle = document.createElement('h2');
            listTitle.textContent = "Lịch sử đặt chỗ của bạn";
            listTitle.className = "my-bookings-list-title-vj";
            myBookingsListContainer.appendChild(listTitle);

            bookings.forEach(booking => {
                const bookingSummaryDiv = document.createElement('div');
                bookingSummaryDiv.className = 'booking-summary-item-vj';
                
                const statusInfo = statusMapping[booking.booking_status] || { text: booking.booking_status || 'N/A' };
                const displayDate = booking.flight_date_formatted || 'N/A';
                
                bookingSummaryDiv.innerHTML = `
                    <h4>Mã đặt chỗ: ${booking.pnr}</h4>
                    <p>Hành trình: ${booking.departure_city} → ${booking.arrival_city}</p>
                    <p>Ngày bay: ${displayDate}</p>
                    <p>Trạng thái: ${statusInfo.text}</p>
                    <button class="action-btn-vj primary-btn-vj btn-view-booking-detail" data-booking-pnr="${booking.pnr}" style="padding: 6px 12px; font-size: 0.85rem; margin-top: 5px;">Xem chi tiết</button>
                `;
                bookingSummaryDiv.querySelector('.btn-view-booking-detail').addEventListener('click', function(){
                    const pnrToView = this.dataset.bookingPnr;
                    const detailData = allUserBookings.find(b => b.pnr === pnrToView);
                    if(detailData) renderFlightCard(detailData);
                });
                myBookingsListContainer.appendChild(bookingSummaryDiv);
            });
        }
        myBookingsListContainer.style.display = "block";
    }

    if (lookupForm) {
        lookupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const pnr = document.getElementById('lookup-booking-code').value.trim().toUpperCase();
            const lastName = document.getElementById('lookup-last-name').value.trim();
            const firstName = document.getElementById('lookup-first-name').value.trim();

            if (!pnr || !lastName || !firstName) {
                if(lookupErrorMsg) {
                    lookupErrorMsg.textContent = "Vui lòng nhập đầy đủ Mã đặt chỗ, Họ và Tên.";
                    lookupErrorMsg.style.display = 'block';
                }
                return;
            }

            try {
                const response = await fetch('/api/bookings/lookup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pnr: pnr, lastName: lastName, firstName: firstName })
                });
                const result = await response.json();

                if (response.ok && result.success && result.booking) {
                    renderFlightCard(result.booking);
                } else {
                    if(lookupErrorMsg) {
                        lookupErrorMsg.textContent = result.message || "Không tìm thấy thông tin đặt chỗ phù hợp.";
                        lookupErrorMsg.style.display = 'block';
                    }
                }
            } catch (error) {
                if(lookupErrorMsg) {
                    lookupErrorMsg.textContent = "Đã xảy ra lỗi kết nối. Vui lòng thử lại.";
                    lookupErrorMsg.style.display = 'block';
                }
            }
        });
    }

    async function fetchMyBookingsOnLoad() {
        try {
            const authResponse = await fetch('/api/auth/status');
            const authData = await authResponse.json();

            if (authData.logged_in) {
                const bookingsResponse = await fetch('/api/my-bookings');
                const bookingsData = await bookingsResponse.json();

                if (bookingsResponse.ok && bookingsData.success && bookingsData.bookings) {
                    allUserBookings = bookingsData.bookings;
                    renderMyBookingsList(allUserBookings);
                } else {
                    if (myBookingsListContainer) myBookingsListContainer.innerHTML = `<p>${bookingsData.message || 'Không tải được danh sách chuyến bay của bạn.'}</p>`;
                }
            } else {
                if (myBookingsListContainer) myBookingsListContainer.innerHTML = "<p>Vui lòng đăng nhập để xem chuyến bay của bạn, hoặc sử dụng form tra cứu nếu có mã đặt chỗ.</p>";
            }
        } catch (error) {
            console.error("Lỗi khi tải danh sách chuyến bay của tôi:", error);
            if (myBookingsListContainer) myBookingsListContainer.innerHTML = "<p>Lỗi kết nối khi tải chuyến bay của bạn.</p>";
        }
        if (myBookingsListContainer) myBookingsListContainer.style.display = "block";
    }

    async function loadMealsIntoModal() {
        if (!mealOptionsContainer) return;
        mealOptionsContainer.innerHTML = '<p>Đang tải thực đơn...</p>';
        try {
            const response = await fetch('/api/menu-items');
            const data = await response.json();
            if (data.success && data.menu_items) {
                mealOptionsContainer.innerHTML = '';
                if(data.menu_items.length === 0) {
                    mealOptionsContainer.innerHTML = '<p>Thực đơn hiện chưa có món nào.</p>';
                    return;
                }
                data.menu_items.forEach(item => {
                    const itemEl = document.createElement('div');
                    itemEl.className = 'meal-option-item';
                    itemEl.innerHTML = `
                        <img src="${item.image_url_full}" alt="${item.name}" class="meal-item-image">
                        <div class="meal-item-details">
                            <span class="meal-item-name">${item.name}</span>
                            <span class="meal-item-price">${item.price_vnd.toLocaleString('vi-VN')} VND</span>
                        </div>
                        <div class="meal-item-quantity">
                            <input type="number" name="menu_item_${item.id}"
                                   data-price="${item.price_vnd}"
                                   min="0" value="0" class="meal-quantity-input">
                        </div>
                    `;
                    mealOptionsContainer.appendChild(itemEl);
                });
                mealOptionsContainer.querySelectorAll('.meal-quantity-input').forEach(input => {
                    input.addEventListener('input', updateModalServiceFees);
                });
            } else {
                mealOptionsContainer.innerHTML = '<p>Không thể tải thực đơn.</p>';
            }
        } catch (error) {
            console.error("Lỗi tải E-Menu cho modal:", error);
            mealOptionsContainer.innerHTML = '<p>Lỗi kết nối khi tải thực đơn.</p>';
        }
    }

    function updateModalServiceFees() {
        let totalMealCost = 0;
        document.querySelectorAll('.meal-quantity-input').forEach(input => {
            const quantity = parseInt(input.value) || 0;
            const price = parseFloat(input.dataset.price) || 0;
            if (quantity > 0) {
                 totalMealCost += quantity * price;
            }
        });
        if (mealFeeDisplay) mealFeeDisplay.textContent = formatCurrency(totalMealCost);
        if(totalServiceCostDisplay) totalServiceCostDisplay.textContent = formatCurrency(totalMealCost);
    }

    function attachActionListenersToCard(booking) {
        const card = flightDetailsSection.querySelector(`.flight-card-vj[data-pnr="${booking.pnr}"]`);
        if (!card) return;

        card.querySelector('.online-checkin-btn-vj')?.addEventListener('click', () => {
            const lastName = booking.passengers && booking.passengers.length > 0 ? booking.passengers[0].last_name : '';
            if (booking.pnr && lastName) {
                window.location.href = `/check-in-online?pnr=${booking.pnr}&lastName=${encodeURIComponent(lastName)}`;
            } else {
                alert("Không đủ thông tin hành khách để làm thủ tục.");
            }
        });

        // <<< SỬA LỖI Ở ĐÂY >>>
        card.querySelector('.add-service-btn-show-vj')?.addEventListener('click', () => {
             if (serviceModal && currentBookingDataForCard) {
                document.getElementById('modal-service-pnr-display-vj').textContent = currentBookingDataForCard.pnr;
                // Sửa lại tên biến bị sai chính tả ở đây
                document.getElementById('service-booking-id').value = currentBookingDataForCard.booking_id;
                loadMealsIntoModal();
                updateModalServiceFees();
                serviceModal.style.display = 'flex';
            }
        });

        const cancelBtn = card.querySelector('.cancel-booking-btn-vj');
        if(cancelBtn) {
            cancelBtn.addEventListener('click', async function() {
                const bookingId = card.dataset.bookingId;
                if (confirm("Bạn có chắc chắn muốn hủy đặt chỗ này không? Hành động này không thể hoàn tác.")) {
                    this.textContent = "Đang xử lý...";
                    this.disabled = true;
                    try {
                        const response = await fetch('/api/bookings/cancel', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ booking_id: bookingId })
                        });
                        const result = await response.json();
                        alert(result.message);
                        if (result.success) {
                            fetchMyBookingsOnLoad();
                        } else {
                            this.textContent = "Hủy chuyến";
                            this.disabled = false;
                        }
                    } catch (error) {
                        alert("Lỗi kết nối khi hủy chuyến.");
                        this.textContent = "Hủy chuyến";
                        this.disabled = false;
                    }
                }
            });
        }

        const backToListBtn = document.getElementById('back-to-list-btn'); 
        if (backToListBtn) {
            backToListBtn.addEventListener('click', () => {
                renderMyBookingsList(allUserBookings);
            });
        }
    }

    if (closeServiceModalBtn && serviceModal) {
        closeServiceModalBtn.addEventListener('click', () => { serviceModal.style.display = 'none'; });
    }
    
    window.addEventListener('click', (event) => {
        if (event.target == serviceModal) {
            serviceModal.style.display = 'none';
        }
    });

    if (addServiceForm) {
        addServiceForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const bookingId = currentBookingDataForCard?.booking_id;
            if (!bookingId) {
                alert("Lỗi: Không tìm thấy thông tin đặt chỗ.");
                return;
            }
            const selectedItems = [];
            mealOptionsContainer.querySelectorAll('.meal-quantity-input').forEach(input => {
                const quantity = parseInt(input.value);
                if (quantity > 0) {
                    selectedItems.push({
                        menu_item_id: parseInt(input.name.replace('menu_item_', '')),
                        quantity: quantity
                    });
                }
            });
            if (selectedItems.length === 0) {
                alert("Bạn chưa chọn món ăn nào.");
                return;
            }
            const submitBtn = addServiceForm.querySelector('.modal-submit-btn-vj');
            submitBtn.textContent = "Đang xử lý...";
            submitBtn.disabled = true;
            try {
                const response = await fetch(`/api/bookings/${bookingId}/add-menu-items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ menu_items: selectedItems })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    alert("Đã cập nhật dịch vụ. Đang chuyển đến trang thanh toán...");
                    window.location.href = "/thanh-toan";
                } else {
                    alert("Lỗi: " + (result.message || "Không thể thêm suất ăn."));
                }
            } catch (error) {
                alert("Lỗi kết nối. Vui lòng thử lại.");
            } finally {
                submitBtn.textContent = "Xác nhận và Thanh toán";
                submitBtn.disabled = false;
            }
        });
    }

    fetchMyBookingsOnLoad();
});