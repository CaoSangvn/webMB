// app/static/js/home_script.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("home_script.js loaded!");

    // === DOM Elements ===
    const tabs = document.querySelectorAll(".booking-section .tabs .tab");
    const tabContents = document.querySelectorAll(".booking-section .tab-content");

    const baggageOptionSelect = document.getElementById("baggage-option");
    const seatPreferenceSelect = document.getElementById("seat-preference");
    const extraLegroomCheckbox = document.getElementById("seat-extra-legroom");
    const baggageFeeDisplay = document.getElementById("baggage-fee-display");
    const seatFeeDisplay = document.getElementById("seat-fee-display");
    const totalAncillaryCostDisplay = document.getElementById("total-ancillary-cost-display");
    
    const bookingForm = document.getElementById("booking-form");
    const flightResultsSection = document.getElementById("flight-results");
    const flightOptionsContainer = document.getElementById("flight-options-container");
    const adultInput = document.getElementById("adult-count");
    const childInput = document.getElementById("child-count");

    // === LOGIC CHUYỂN TAB ===
    if (tabs.length > 0 && tabContents.length > 0) {
        tabs.forEach(tab => {
          tab.addEventListener("click", function () {
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

    // === Functions ===
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

    async function handleBookButtonClick() {
        this.disabled = true;
        this.textContent = 'Đang xử lý...';
    
        const flightId = this.dataset.flightId;
        const seatClass = this.dataset.seatClass;
    
        try {
            const authStatusResponse = await fetch('/api/auth/status');
            const authStatusResult = await authStatusResponse.json();
    
            if (authStatusResult.logged_in && authStatusResult.user) {
                const baggageOption = baggageOptionSelect.value;
                let seatOption = seatPreferenceSelect.value;
                if (extraLegroomCheckbox.checked) {
                    seatOption = 'extra_legroom';
                }

                const bookingData = {
                    flight_id: parseInt(flightId),
                    seat_class_booked: seatClass,
                    num_adults: parseInt(adultInput.value) || 1,
                    num_children: parseInt(childInput.value) || 0,
                    passengers_data: [{ full_name: authStatusResult.user.full_name, type: 'adult' }],
                    payment_method: 'online',
                    baggage_option: baggageOption,
                    seat_option: seatOption
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

    if (bookingForm) {
        bookingForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            // ... (Code tìm kiếm chuyến bay giữ nguyên như phiên bản hoàn chỉnh trước đó)
        });
    }

    function renderFlightResults(flights, selectedSeatClass) {
        // ... (Code render kết quả chuyến bay giữ nguyên như phiên bản hoàn chỉnh trước đó)
    }
});