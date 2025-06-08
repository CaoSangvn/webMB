// app/static/js/home_script.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("home_script.js loaded!");

    // === DOM Elements ===
    const tabs = document.querySelectorAll(".booking-section .tabs .tab");
    const tabContents = document.querySelectorAll(".booking-section .tab-content");
    const bookingForm = document.getElementById("booking-form");
    const flightResultsSection = document.getElementById("flight-results");
    const flightOptionsContainer = document.getElementById("flight-options-container");
    const adultInput = document.getElementById("adult-count");
    const childInput = document.getElementById("child-count");
    const totalPassengersInput = document.getElementById("total-passengers");
    const baggageOptionSelect = document.getElementById("baggage-option");
    const seatPreferenceSelect = document.getElementById("seat-preference");
    const extraLegroomCheckbox = document.getElementById("seat-extra-legroom");
    const baggageFeeDisplay = document.getElementById("baggage-fee-display");
    const seatFeeDisplay = document.getElementById("seat-fee-display");
    const totalAncillaryCostDisplay = document.getElementById("total-ancillary-cost-display");
    const luggageSeatingForm = document.getElementById("luggage-seating-form");

    // <<< BẮT ĐẦU PHẦN CẬP NHẬT MỚI >>>
    // Hàm để gọi API và hiển thị thông báo trên trang chủ
    const loadHomepageNotices = async () => {
        const noticeContainer = document.getElementById('dynamic-notice-items-container');
        const noticeTitle = document.getElementById('notice-main-title');
        
        if (!noticeContainer || !noticeTitle) return;

        try {
            const response = await fetch('/api/homepage-content');
            const data = await response.json();

            if (data.success) {
                noticeTitle.textContent = data.notice_title || 'THÔNG BÁO';
                noticeContainer.innerHTML = '';

                if (data.notice_items && data.notice_items.length > 0) {
                    data.notice_items.forEach(item => {
                        const p = document.createElement('p');
                        p.innerHTML = item.content; 
                        noticeContainer.appendChild(p);
                    });
                } else {
                    noticeContainer.innerHTML = '<p>Hiện không có thông báo nào.</p>';
                }
            }
        } catch (error) {
            console.error('Lỗi khi tải thông báo trang chủ:', error);
        }
    };

    // Gọi hàm này ngay khi trang được tải xong
    loadHomepageNotices();
    // <<< KẾT THÚC PHẦN CẬP NHẬT MỚI >>>

    // === LOGIC CHUYỂN TAB ===
    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener("click", function() {
                tabs.forEach(item => item.classList.remove("active"));
                tabContents.forEach(content => content.classList.remove("active"));
                this.classList.add("active");
                const tabContentElement = document.getElementById(this.dataset.tab);
                if (tabContentElement) {
                    tabContentElement.classList.add("active");
                }
            });
        });
    }

    // === LOGIC CẬP NHẬT SỐ LƯỢNG HÀNH KHÁCH ===
    function updateTotalPassengers() {
        const adults = parseInt(adultInput.value) || 0;
        const children = parseInt(childInput.value) || 0;
        totalPassengersInput.value = adults + children;
    }
    if (adultInput && childInput && totalPassengersInput) {
        adultInput.addEventListener('input', updateTotalPassengers);
        childInput.addEventListener('input', updateTotalPassengers);
    }

    // === LOGIC TÍNH PHÍ DỊCH VỤ CỘNG THÊM ===
    function updateAncillaryFees() {
        if (!baggageOptionSelect || !seatPreferenceSelect || !extraLegroomCheckbox) return;
        let baggagePrice = parseFloat(baggageOptionSelect.options[baggageOptionSelect.selectedIndex].dataset.price) || 0;
        let seatPrefPrice = parseFloat(seatPreferenceSelect.options[seatPreferenceSelect.selectedIndex].dataset.price) || 0;
        let extraLegroomPrice = extraLegroomCheckbox.checked ? (parseFloat(extraLegroomCheckbox.dataset.price) || 0) : 0;
        const totalSeatFee = seatPrefPrice + extraLegroomPrice;
        const totalAncillary = baggagePrice + totalSeatFee;

        if (baggageFeeDisplay) baggageFeeDisplay.textContent = `${baggagePrice.toLocaleString('vi-VN')} VND`;
        if (seatFeeDisplay) seatFeeDisplay.textContent = `${totalSeatFee.toLocaleString('vi-VN')} VND`;
        if (totalAncillaryCostDisplay) totalAncillaryCostDisplay.textContent = `${totalAncillary.toLocaleString('vi-VN')} VND`;
    }
    if (baggageOptionSelect) baggageOptionSelect.addEventListener("change", updateAncillaryFees);
    if (seatPreferenceSelect) seatPreferenceSelect.addEventListener("change", updateAncillaryFees);
    if (extraLegroomCheckbox) extraLegroomCheckbox.addEventListener("change", updateAncillaryFees);
    updateAncillaryFees();

    // === LOGIC XỬ LÝ NÚT "XÁC NHẬN LỰA CHỌN" (SỬA LỖI 405) ===
    if (luggageSeatingForm) {
        luggageSeatingForm.addEventListener("submit", function(e) {
            e.preventDefault();
            alert("Các lựa chọn về hành lý và chỗ ngồi đã được ghi nhận. Vui lòng quay lại tab 'Đặt vé' để tìm và đặt chuyến bay.");
        });
    }

    // === LOGIC HIỂN THỊ KẾT QUẢ TÌM KIẾM ===
    function renderFlightResults(flights, selectedSeatClass) {
        flightOptionsContainer.innerHTML = '';
        if (flights.length === 0) {
            flightOptionsContainer.innerHTML = '<p style="color: white; text-align: center;">Không có chuyến bay nào phù hợp với yêu cầu của bạn.</p>';
        } else {
            flights.forEach(flight => {
                const flightHTML = `
                    <div class="flight-option">
                        <div class="flight-details">
                            <h3>${flight.origin_iata} → ${flight.destination_iata}</h3>
                            <p>Số hiệu: <strong>${flight.flight_number}</strong></p>
                            <p>Khởi hành: ${flight.departure_time_formatted}</p>
                            <p>Thời gian bay: ${flight.duration_formatted}</p>
                        </div>
                        <div class="flight-pricing" style="text-align: right;">
                            <p style="font-size: 1.2rem; font-weight: bold; color: #ffeb3b;">${(flight.price || 0).toLocaleString('vi-VN')} VND</p>
                            <button class="book-btn" data-flight-id="${flight.id}" data-seat-class="${selectedSeatClass}">Đặt vé</button>
                        </div>
                    </div>
                `;
                flightOptionsContainer.innerHTML += flightHTML;
            });
            attachBookButtonListeners();
        }
        flightResultsSection.style.display = 'block';
    }

    // === LOGIC XỬ LÝ FORM TÌM CHUYẾN BAY ===
    if (bookingForm) {
        bookingForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            const searchButton = this.querySelector('.search-btn');
            searchButton.textContent = 'Đang tìm...';
            searchButton.disabled = true;

            const formData = new FormData(this);
            const searchData = {
                origin_iata: formData.get('origin'),
                destination_iata: formData.get('destination'),
                departure_date: formData.get('departure_date'),
                passengers: formData.get('total_passengers'),
                seat_class: formData.get('seat_class')
            };

            if (!searchData.origin_iata || !searchData.destination_iata || !searchData.departure_date) {
                alert("Vui lòng chọn điểm đi, điểm đến và ngày đi.");
                searchButton.textContent = 'Tìm chuyến bay';
                searchButton.disabled = false;
                return;
            }

            try {
                const response = await fetch('/api/flights/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(searchData)
                });
                const result = await response.json();
                if (result.success && result.flights) {
                    renderFlightResults(result.flights, searchData.seat_class);
                } else {
                    flightOptionsContainer.innerHTML = `<p style="color: #ffcdd2; text-align: center;">${result.message || 'Không tìm thấy chuyến bay nào.'}</p>`;
                    flightResultsSection.style.display = 'block';
                }
            } catch (error) {
                console.error("Lỗi khi tìm chuyến bay:", error);
                flightOptionsContainer.innerHTML = `<p style="color: #ffcdd2; text-align: center;">Lỗi kết nối. Vui lòng thử lại.</p>`;
                flightResultsSection.style.display = 'block';
            } finally {
                searchButton.textContent = 'Tìm chuyến bay';
                searchButton.disabled = false;
            }
        });
    }

    // === LOGIC XỬ LÝ NÚT "ĐẶT VÉ" ===
    async function handleBookButtonClick() {
        this.disabled = true;
        this.textContent = 'Đang xử lý...';
        const flightId = this.dataset.flightId;
        const seatClass = this.dataset.seatClass;

        try {
            const authStatusResponse = await fetch('/api/auth/status');
            const authStatusResult = await authStatusResponse.json();

            if (authStatusResult.logged_in && authStatusResult.user) {
                let baggagePrice = parseFloat(baggageOptionSelect.options[baggageOptionSelect.selectedIndex].dataset.price) || 0;
                let seatPrefPrice = parseFloat(seatPreferenceSelect.options[seatPreferenceSelect.selectedIndex].dataset.price) || 0;
                let extraLegroomPrice = extraLegroomCheckbox.checked ? (parseFloat(extraLegroomCheckbox.dataset.price) || 0) : 0;
                const totalAncillaryCost = baggagePrice + seatPrefPrice + extraLegroomPrice;

                const bookingData = {
                    flight_id: parseInt(flightId),
                    seat_class_booked: seatClass,
                    num_adults: parseInt(adultInput.value) || 1,
                    num_children: parseInt(childInput.value) || 0,
                    num_infants: 0,
                    passengers_data: [{
                        full_name: authStatusResult.user.full_name,
                        type: 'adult'
                    }],
                    payment_method: 'online',
                    ancillary_cost: totalAncillaryCost
                };

                const createBookingResponse = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData)
                });
                const createResult = await createBookingResponse.json();

                if (createBookingResponse.ok && createResult.success) {
                    alert(createResult.message);
                    window.location.href = createResult.redirect_url;
                } else {
                    alert("Lỗi: " + (createResult.message || "Không thể tạo đặt chỗ."));
                    this.disabled = false;
                    this.textContent = 'Đặt vé';
                }
            } else {
                alert("Vui lòng đăng nhập để tiếp tục đặt vé.");
                window.location.href = '/dang-nhap';
            }
        } catch (error) {
            console.error("Lỗi khi xử lý đặt vé:", error);
            alert("Có lỗi kết nối xảy ra.");
            this.disabled = false;
            this.textContent = 'Đặt vé';
        }
    }
    
    function attachBookButtonListeners() {
        const newBookButtons = document.querySelectorAll(".book-btn");
        if (newBookButtons.length > 0) {
            newBookButtons.forEach(button => {
                button.addEventListener("click", handleBookButtonClick);
            });
        }
    }
});