// app/static/js/home_script.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("home_script.js loaded with ALL fixes!");

    // === DOM Elements (Giữ nguyên từ code của bạn) ===
    const tabs = document.querySelectorAll(".booking-section .tabs .tab");
    const tabContents = document.querySelectorAll(".booking-section .tab-content");
    const bookingForm = document.getElementById("booking-form");
    const flightResultsSection = document.getElementById("flight-results");
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

    // === CÁC HÀM CŨ CỦA BẠN (GIỮ NGUYÊN) ===
    function handleTripTypeChange() {
        const selectedTripType = document.querySelector('input[name="trip"]:checked').value;
        if (selectedTripType === 'oneway') {
            if (returnDateGroup) returnDateGroup.style.display = 'none';
            if (returnDateInput) returnDateInput.value = '';
        } else {
            if (returnDateGroup) returnDateGroup.style.display = 'block';
        }
    }

    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function initNoticeCarousel() {
        const container = document.getElementById('dynamic-notice-items-container');
        if (!container) return;
        const items = container.querySelectorAll('p');
        if (items.length <= 1) {
            if (items.length === 1) items[0].classList.add('is-active');
            return;
        }
        let currentItemIndex = 0;
        items.forEach(item => item.classList.remove('is-active'));
        if(items[currentItemIndex]) items[currentItemIndex].classList.add('is-active');
        setInterval(() => {
            if(items[currentItemIndex]) items[currentItemIndex].classList.remove('is-active');
            currentItemIndex = (currentItemIndex + 1) % items.length;
            if(items[currentItemIndex]) items[currentItemIndex].classList.add('is-active');
        }, 5000);
    }

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
                initNoticeCarousel();
            }
        } catch (error) {
            console.error('Lỗi khi tải thông báo trang chủ:', error);
        }
    };

    function updateTotalPassengers() {
        const adults = parseInt(adultInput.value) || 0;
        const children = parseInt(childInput.value) || 0;
        if(totalPassengersInput) totalPassengersInput.value = adults + children;
    }

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

    function renderFlightResults(flightsData, seatClass) {
        const depContainer = document.getElementById('departure-flight-options-container');
        const retContainer = document.getElementById('return-flight-options-container');
        const depResultsDiv = document.getElementById('departure-flights-results');
        const retResultsDiv = document.getElementById('return-flights-results');

        const renderList = (container, flightList, message = '') => {
            let content = '';
            if (message) content += `<p class="suggestion-message">${message}</p>`;
            if (!flightList || flightList.length === 0) {
                if (!message) content += '<p class="no-flights-message">Không có chuyến bay nào phù hợp.</p>';
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

        if (depResultsDiv) depResultsDiv.style.display = 'block';
        if (retResultsDiv) retResultsDiv.style.display = 'none';

        const depResults = flightsData.departure_results;
        if (depResults && depContainer) {
            if (depResults.exact_flights.length > 0) renderList(depContainer, depResults.exact_flights);
            else if (depResults.suggested_flights.length > 0) renderList(depContainer, depResults.suggested_flights, "Không tìm thấy chuyến bay vào ngày bạn chọn. Dưới đây là các chuyến bay ở những ngày lân cận:");
            else renderList(depContainer, []);
        }

        const retResults = flightsData.return_results;
        if (retResults && retContainer && retResultsDiv) {
            retResultsDiv.style.display = 'block';
            if (retResults.exact_flights.length > 0) renderList(retContainer, retResults.exact_flights);
            else if (retResults.suggested_flights.length > 0) renderList(retContainer, retResults.suggested_flights, "Không có chuyến bay về vào ngày bạn chọn. Dưới đây là các chuyến bay lân cận:");
            else renderList(retContainer, []);
        }

        if(flightResultsSection) flightResultsSection.style.display = 'block';
        attachBookButtonListeners();
    }
    
    // SỬA LỖI "METHOD NOT ALLOWED": Thêm hàm xử lý tìm kiếm
    async function handleSearch(e) {
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
                if(flightResultsSection) flightResultsSection.style.display = 'none';
            }
        } catch (error) {
            console.error("Lỗi khi tìm chuyến bay:", error);
            alert("Lỗi kết nối. Vui lòng thử lại.");
        } finally {
            searchButton.textContent = 'Tìm chuyến bay';
            searchButton.disabled = false;
        }
    }

    // === BẮT ĐẦU PHẦN SỬA LỖI VÀ THÊM LOGIC MỚI ===

    async function handleBookButtonClick() {
        const authStatusResponse = await fetch('/api/auth/status');
        const authStatusResult = await authStatusResponse.json();
        if (!authStatusResult.logged_in) {
            alert("Vui lòng đăng nhập để tiếp tục đặt vé.");
            window.location.href = '/dang-nhap';
            return;
        }
        const flightId = this.dataset.flightId;
        const seatClass = this.dataset.seatClass;
        const numAdults = parseInt(adultInput.value) || 1;
        const numChildren = parseInt(childInput.value) || 0;
        const totalPassengers = numAdults + numChildren;
        const modal = document.getElementById('passenger-info-modal');
        const container = document.getElementById('passenger-forms-container');
        container.innerHTML = '';
        document.getElementById('modal-flight-id').value = flightId;
        document.getElementById('modal-seat-class').value = seatClass;
        for (let i = 0; i < totalPassengers; i++) {
            const passengerType = i < numAdults ? 'Người lớn' : 'Trẻ em';
            const formHTML = `
                <div class="passenger-form-group" data-passenger-type="${i < numAdults ? 'adult' : 'child'}">
                    <h4>Hành khách ${i + 1} (${passengerType})</h4>
                    <div class="form-row">
                        <label for="full_name_${i}">Họ và tên *</label>
                        <input type="text" id="full_name_${i}" class="passenger-full-name" required placeholder="Nhập đầy đủ họ tên">
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', formHTML);
        }
        modal.style.display = 'flex';
    }

    async function handleConfirmPassengerInfo(event) {
        event.preventDefault();
        const confirmBtn = document.getElementById('confirm-passenger-info-btn');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Đang xử lý...';
        const flightId = document.getElementById('modal-flight-id').value;
        const seatClass = document.getElementById('modal-seat-class').value;
        const passengersData = [];
        const passengerForms = document.querySelectorAll('.passenger-form-group');
        let isFormValid = true;
        passengerForms.forEach(form => {
            const fullNameInput = form.querySelector('.passenger-full-name');
            if (!fullNameInput.value.trim()) isFormValid = false;
            passengersData.push({
                full_name: fullNameInput.value.trim(),
                passenger_type: form.dataset.passengerType
            });
        });
        if (!isFormValid) {
            alert('Vui lòng điền đầy đủ họ và tên cho tất cả hành khách.');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Xác nhận và Tiếp tục';
            return;
        }
        const bookingData = {
             flight_id: parseInt(flightId),
             seat_class_booked: seatClass,
             passengers_data: passengersData,
             num_adults: parseInt(document.getElementById("adult-count").value) || 1,
             num_children: parseInt(document.getElementById("child-count").value) || 0,
             payment_method: 'online', // <<< THÊM DÒNG NÀY
             ancillary_cost: 0 // Thêm cả dòng này để nhất quán với model
};
        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });
            const result = await response.json();
            if (response.ok && result.redirect_url) {
                alert(result.message || "Tạo đặt chỗ thành công!");
                window.location.href = result.redirect_url;
            } else {
                alert(result.error || 'Đã xảy ra lỗi khi tạo đặt chỗ.');
            }
        } catch (error) {
            alert('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Xác nhận và Tiếp tục';
        }
    }

    function attachBookButtonListeners() {
        document.querySelectorAll(".book-btn").forEach(button => {
            button.addEventListener("click", handleBookButtonClick);
        });
    }

    // === GẮN CÁC EVENT LISTENERS KHI TẢI TRANG ===
    loadHomepageNotices();
    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener("click", function() {
                tabs.forEach(item => item.classList.remove("active"));
                tabContents.forEach(content => content.classList.remove("active"));
                this.classList.add("active");
                const tabContentElement = document.getElementById(this.dataset.tab);
                if (tabContentElement) tabContentElement.classList.add("active");
            });
        });
    }
    if (adultInput && childInput && totalPassengersInput) {
        adultInput.addEventListener('input', updateTotalPassengers);
        childInput.addEventListener('input', updateTotalPassengers);
        updateTotalPassengers();
    }
    if (baggageOptionSelect) baggageOptionSelect.addEventListener("change", updateAncillaryFees);
    if (seatPreferenceSelect) seatPreferenceSelect.addEventListener("change", updateAncillaryFees);
    if (extraLegroomCheckbox) extraLegroomCheckbox.addEventListener("change", updateAncillaryFees);
    updateAncillaryFees();
    if (luggageSeatingForm) {
        luggageSeatingForm.addEventListener("submit", function(e) {
            e.preventDefault();
            alert("Các lựa chọn về hành lý và chỗ ngồi đã được ghi nhận. Vui lòng quay lại tab 'Đặt vé' để tìm và đặt chuyến bay.");
        });
    }
    if (bookingForm) {
        bookingForm.addEventListener("submit", handleSearch);
    }
    if (tripTypeRadios.length > 0) {
        tripTypeRadios.forEach(radio => radio.addEventListener('change', handleTripTypeChange));
        handleTripTypeChange();
    }
    if (departureDateInput && returnDateInput) {
        const today = getTodayDateString();
        departureDateInput.min = today;
        returnDateInput.min = today;
        departureDateInput.value = today;
        departureDateInput.addEventListener('change', function() {
            if (this.value) {
                returnDateInput.min = this.value;
                if (returnDateInput.value < this.value) returnDateInput.value = this.value;
            }
        });
    }
    const destinations = document.querySelectorAll(".destination");
    const departureSelect = document.getElementById("departure");
    const destinationSelect = document.getElementById("destination");
    const destinationMap = { "TP. HCM": "SGN", "Hà Nội": "HAN", "Đà Nẵng": "DAD", "Huế": "HUI", "Phú Quốc": "PQC", "Nha Trang": "CXR", "Côn Đảo": "VCS", "Quảng Bình": "VDH", "Nghệ An": "VII" };
    if (destinations.length > 0 && departureSelect && destinationSelect) {
        destinations.forEach(dest => {
            dest.addEventListener("click", () => {
                const locationName = dest.getAttribute("data-destination");
                const iataCode = destinationMap[locationName];
                if (iataCode) destinationSelect.value = iataCode;
                if (!departureSelect.value && departureSelect.querySelector('option[value="HAN"]')) {
                    departureSelect.value = "HAN";
                }
                if(bookingForm) bookingForm.scrollIntoView({ behavior: "smooth" });
            });
        });
    }
    const passengerModal = document.getElementById('passenger-info-modal');
    if (passengerModal) {
        const closeBtn = passengerModal.querySelector('.close-btn');
        const passengerForm = document.getElementById('passenger-form');
        if (closeBtn) closeBtn.onclick = function() { passengerModal.style.display = "none"; };
        window.onclick = function(event) { if (event.target == passengerModal) passengerModal.style.display = "none"; };
        if (passengerForm) passengerForm.addEventListener('submit', handleConfirmPassengerInfo);
    }
});

// Logic carousel tin tức nằm ngoài DOMContentLoaded
const newsTrack = document.querySelector(".news-track");
if (newsTrack) {
    const newsItems = newsTrack.querySelectorAll(".news-vertical-item");
    if (newsItems.length > 0) {
        const visibleCount = 4;
        const itemHeight = newsItems[0].offsetHeight + 10;
        const totalNewsItems = newsItems.length;
        for (let i = 0; i < Math.min(visibleCount, totalNewsItems); i++) {
            const clone = newsItems[i].cloneNode(true);
            newsTrack.appendChild(clone);
        }
        let newsIndex = 0;
        let allowNewsTransition = true;
        function updateNewsScroll() {
            newsTrack.style.transition = allowNewsTransition ? "transform 0.6s ease-in-out" : "none";
            newsTrack.style.transform = `translateY(-${newsIndex * itemHeight}px)`;
        }
        if (totalNewsItems > visibleCount) {
            setInterval(() => {
                newsIndex++;
                allowNewsTransition = true;
                updateNewsScroll();
                if (newsIndex === totalNewsItems) {
                    setTimeout(() => {
                        allowNewsTransition = false;
                        newsIndex = 0;
                        updateNewsScroll();
                    }, 650);
                }
            }, 5000);
        }
        updateNewsScroll();
    }
}