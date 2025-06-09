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
    const departureDateInput = document.getElementById('departure-date');
    const tripTypeRadios = document.querySelectorAll('input[name="trip"]');
    const returnDateGroup = document.getElementById('return-date-group');
    const returnDateInput = document.getElementById('return-date');
    function handleTripTypeChange() {
        // Tìm radio button đang được chọn
        const selectedTripType = document.querySelector('input[name="trip"]:checked').value;
        
        if (selectedTripType === 'oneway') {
            // Nếu là "Một chiều", ẩn ô ngày về và xóa giá trị
            if (returnDateGroup) {
                returnDateGroup.style.display = 'none';
            }
            if (returnDateInput) {
                returnDateInput.value = ''; 
            }
        } else { // Nếu là "Khứ hồi"
            // Hiện lại ô ngày về
            if (returnDateGroup) {
                returnDateGroup.style.display = 'block';
            }
        }
    }

    // Gắn sự kiện 'change' cho tất cả các radio button có name="trip"
    if (tripTypeRadios.length > 0) {
        tripTypeRadios.forEach(radio => {
            radio.addEventListener('change', handleTripTypeChange);
        });
        
        // Chạy hàm một lần khi tải trang để đảm bảo trạng thái ban đầu đúng
        // (nút "Khứ hồi" đang được chọn sẵn)
        handleTripTypeChange();
    }

    // Hàm helper để lấy ngày hôm nay theo định dạng YYYY-MM-DD
    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Thiết lập ngày tối thiểu cho ngày đi và ngày về
    if (departureDateInput && returnDateInput) {
        const today = getTodayDateString();
        
        // Đặt ngày nhỏ nhất được chọn là ngày hôm nay cho cả hai trường
        departureDateInput.min = today;
        returnDateInput.min = today;

        // Tùy chọn: Đặt giá trị mặc định cho ngày đi là ngày hôm nay cho tiện dụng
        departureDateInput.value = today;

        // Thêm sự kiện để khi chọn ngày đi, ngày về không thể nhỏ hơn
        departureDateInput.addEventListener('change', function() {
            if (this.value) {
                returnDateInput.min = this.value;
                // Nếu ngày về hiện tại nhỏ hơn ngày đi mới, cập nhật ngày về
                if (returnDateInput.value < this.value) {
                    returnDateInput.value = this.value;
                }
            }
        });
    }
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