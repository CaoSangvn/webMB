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
    function initNoticeCarousel() {
    const container = document.getElementById('dynamic-notice-items-container');
    if (!container) return;

    const items = container.querySelectorAll('p');
    if (items.length <= 1) {
        // Nếu chỉ có 1 tin, cho nó hiện ra và không làm gì thêm
        if (items.length === 1) {
            items[0].classList.add('is-active');
        }
        return;
    }

    let currentItemIndex = 0;

    // Lúc đầu, chỉ hiển thị mục đầu tiên
    items.forEach(item => item.classList.remove('is-active'));
    items[currentItemIndex].classList.add('is-active');

    // Bắt đầu vòng lặp thay đổi thông báo
    setInterval(() => {
        // Ẩn mục hiện tại
        items[currentItemIndex].classList.remove('is-active');

        // Tính toán vị trí của mục tiếp theo, quay vòng lại nếu hết
        currentItemIndex = (currentItemIndex + 1) % items.length;

        // Hiển thị mục tiếp theo
        items[currentItemIndex].classList.add('is-active');
    }, 5000); // Đổi thông báo sau mỗi 5 giây
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
                        // Sử dụng .textContent để an toàn hơn, trừ khi bạn chắc chắn nội dung là HTML an toàn
                        p.innerHTML = item.content; 
                        noticeContainer.appendChild(p);
                    });
                } else {
                    noticeContainer.innerHTML = '<p>Hiện không có thông báo nào.</p>';
                }

                // <<< THAY ĐỔI QUAN TRỌNG: GỌI HÀM CAROUSEL TẠI ĐÂY >>>
                // Khởi tạo hiệu ứng trượt sau khi đã thêm các thông báo vào DOM
                initNoticeCarousel();

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
    function renderFlightResults(flightsData, seatClass) {
    const depContainer = document.getElementById('departure-flight-options-container');
    const retContainer = document.getElementById('return-flight-options-container');
    const depResultsDiv = document.getElementById('departure-flights-results');
    const retResultsDiv = document.getElementById('return-flights-results');
    const flightResultsSection = document.getElementById('flight-results');

    // Hàm helper để render một danh sách chuyến bay
    const renderList = (container, flightList, message = '') => {
        let content = '';
        if (message) {
            content += `<p class="suggestion-message">${message}</p>`;
        }

        if (!flightList || flightList.length === 0) {
            // Chỉ hiển thị thông báo này nếu không có cả message gợi ý
            if (!message) {
                content += '<p class="no-flights-message">Không có chuyến bay nào phù hợp.</p>';
            }
        } else {
            flightList.forEach(flight => {
                const flightDate = new Date(flight.departure_time);
                content += `
                    <div class="flight-option">
                        <div class="flight-details">
                            <h3>${flight.origin_iata} → ${flight.destination_iata}</h3>
                            <p style="color: #ffc107; font-weight: bold;">Ngày bay: ${flightDate.toLocaleDateString('vi-VN')}</p>
                            <p>Khởi hành: ${flight.departure_time_formatted}</p>
                            <p>Thời gian bay: ${flight.duration_formatted}</p>
                        </div>
                        <div class="flight-pricing">
                            <p class="price-value">${(flight.price || 0).toLocaleString('vi-VN')} VND</p>
                            <button class="book-btn" data-flight-id="${flight.id}" data-seat-class="${seatClass}">Đặt vé</button>
                        </div>
                    </div>`;
            });
        }
        container.innerHTML = content;
    };

    // Xóa kết quả cũ
    depResultsDiv.style.display = 'block';
    retResultsDiv.style.display = 'none';

    // Xử lý chặng đi
    const depResults = flightsData.departure_results;
    if (depResults) {
        if (depResults.exact_flights.length > 0) {
            renderList(depContainer, depResults.exact_flights);
        } else if (depResults.suggested_flights.length > 0) {
            renderList(depContainer, depResults.suggested_flights, "Không tìm thấy chuyến bay vào ngày bạn chọn. Dưới đây là các chuyến bay ở những ngày lân cận:");
        } else {
            renderList(depContainer, []); // Hiển thị "Không có chuyến bay"
        }
    }

    // Xử lý chặng về
    const retResults = flightsData.return_results;
    if (retResults) {
        retResultsDiv.style.display = 'block';
        if (retResults.exact_flights.length > 0) {
            renderList(retContainer, retResults.exact_flights);
        } else if (retResults.suggested_flights.length > 0) {
            renderList(retContainer, retResults.suggested_flights, "Không có chuyến bay về vào ngày bạn chọn. Dưới đây là các chuyến bay lân cận:");
        } else {
            renderList(retContainer, []);
        }
    }

    flightResultsSection.style.display = 'block';
    attachBookButtonListeners();
}

// === LOGIC XỬ LÝ FORM TÌM CHUYẾN BAY (PHIÊN BẢN MỚI HỖ TRỢ KHỨ HỒI) ===
if (bookingForm) {
    bookingForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const searchButton = this.querySelector('.search-btn');
        searchButton.textContent = 'Đang tìm...';
        searchButton.disabled = true;

        const formData = new FormData(this);
        const tripType = formData.get('trip');

        const searchData = {
            origin_iata: formData.get('origin'),
            destination_iata: formData.get('destination'),
            departure_date: formData.get('departure_date'),
            passengers: formData.get('total_passengers'),
            seat_class: formData.get('seat_class')
        };
        
        // Nếu là khứ hồi, thêm ngày về vào dữ liệu gửi đi
        if (tripType === 'round') {
            searchData.return_date = formData.get('return_date');
            if (!searchData.return_date) {
                alert("Vui lòng chọn ngày về cho chuyến bay khứ hồi.");
                searchButton.textContent = 'Tìm chuyến bay';
                searchButton.disabled = false;
                return;
            }
        }

        try {
            const response = await fetch('/api/flights/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(searchData)
            });
            const result = await response.json();

            if (result.success) {
                renderFlightResults(result.flights, searchData.seat_class);
            } else {
                alert("Lỗi: " + (result.message || "Không tìm thấy chuyến bay nào."));
            }
        } catch (error) {
            console.error("Lỗi khi tìm chuyến bay:", error);
            alert("Lỗi kết nối. Vui lòng thử lại.");
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