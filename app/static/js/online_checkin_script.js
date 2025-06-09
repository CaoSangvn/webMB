document.addEventListener('DOMContentLoaded', function() {
    console.log("Online Check-in Script Loaded - API Integrated!");

    const steps = {
        lookup: document.getElementById('checkin-step-lookup'),
        flightsPassengers: document.getElementById('checkin-step-flights-passengers'),
        dangerousGoods: document.getElementById('checkin-step-dangerous-goods'),
        confirmation: document.getElementById('checkin-step-confirmation')
    };
    const progressSteps = document.querySelectorAll('.checkin-progress-bar-vj .progress-step-vj');
    
    const lookupForm = document.getElementById('checkin-lookup-form');
    const lookupButton = lookupForm ? lookupForm.querySelector('button[type="submit"]') : null;
    const lookupErrorMsg = document.getElementById('lookup-error-message');
    
    const flightsListDiv = document.getElementById('flights-for-checkin-list');
    const passengersListDiv = document.getElementById('passengers-for-checkin-list');
    const passengersSelectionForm = document.getElementById('passengers-selection-form');
    const passengerSelectionError = document.getElementById('passenger-selection-error');

    const dangerousGoodsForm = document.getElementById('dangerous-goods-form');
    const confirmDGBCheckbox = document.getElementById('confirm-dangerous-goods');
    const dangerousGoodsError = document.getElementById('dangerous-goods-error');
    
    const boardingPassSummaryList = document.getElementById('boarding-pass-summary-list');
    
    let currentBookingData = null;
    let selectedPassengerIds = [];

    function updateProgress(currentStepNumber) {
        progressSteps.forEach(step => {
            const stepNum = parseInt(step.dataset.step);
            step.classList.remove('active', 'completed');
            if (stepNum < currentStepNumber) {
                step.classList.add('completed');
            } else if (stepNum === currentStepNumber) {
                step.classList.add('active');
            }
        });
    }

    function showStep(stepId) {
        Object.values(steps).forEach(step => {
            if(step) step.style.display = 'none';
        });
        if (steps[stepId]) {
            steps[stepId].style.display = 'block';
            const stepNumber = Object.keys(steps).indexOf(stepId) + 1;
            updateProgress(stepNumber);
        }
    }

    function displayError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }

    async function handleLookup(pnr, lastName) {
    if(lookupButton) {
        lookupButton.disabled = true;
        lookupButton.textContent = 'Đang tìm...';
    }
    if(lookupErrorMsg) {
        lookupErrorMsg.innerHTML = ''; // Xóa nội dung cũ (quan trọng)
        lookupErrorMsg.style.display = 'none';
    }

    try {
        const response = await fetch('/api/checkin/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_code: pnr, last_name: lastName })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            // Nếu tra cứu thành công, hiển thị bước chọn hành khách
            currentBookingData = result.booking;
            populateFlightsAndPassengersStep();
            showStep('flightsPassengers');
        } else {
            // Nếu có lỗi, xử lý một cách thông minh
            if (result.reason_code === 'PENDING_PAYMENT') {
                // TRƯỜNG HỢP ĐẶC BIỆT: VÉ CHỜ THANH TOÁN
                // 1. Hiển thị thông báo lỗi từ backend
                lookupErrorMsg.innerHTML = `<p>${result.message}</p>`;

                // 2. Tạo một nút "Thanh toán ngay"
                const payButton = document.createElement('button');
                payButton.textContent = 'Thanh toán ngay';
                payButton.className = 'action-btn-vj primary-btn-vj'; // Dùng lại class CSS có sẵn
                payButton.style.marginTop = '10px';

                // 3. Gán sự kiện click cho nút
                payButton.onclick = async () => {
                    payButton.textContent = 'Đang chuyển hướng...';
                    payButton.disabled = true;

                    // Gọi API Bước 2 để chuẩn bị session và lấy URL
                    const prepareResponse = await fetch('/api/payment/prepare', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ booking_id: result.booking_id })
                    });
                    const prepareResult = await prepareResponse.json();

                    if (prepareResult.success) {
                        // Chuyển hướng người dùng đến trang thanh toán
                        window.location.href = prepareResult.redirect_url;
                    } else {
                        alert('Lỗi: ' + prepareResult.message);
                        payButton.textContent = 'Thanh toán ngay';
                        payButton.disabled = false;
                    }
                };

                // 4. Thêm nút vào khu vực báo lỗi và hiển thị nó
                lookupErrorMsg.appendChild(payButton);
                lookupErrorMsg.style.display = 'block';

            } else {
                // Các loại lỗi khác (không tìm thấy PNR, sai tên,...)
                displayError(lookupErrorMsg, result.message || "Không tìm thấy đặt chỗ hoặc thông tin không chính xác.");
            }
        }
    } catch (error) {
        displayError(lookupErrorMsg, "Lỗi kết nối máy chủ. Vui lòng thử lại.");
    } finally {
        if(lookupButton) {
            lookupButton.disabled = false;
            lookupButton.textContent = 'Tìm đặt chỗ';
        }
    }
}

    if (lookupForm) {
        lookupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const pnr = document.getElementById('checkin-booking-code').value.trim().toUpperCase();
            const lastName = document.getElementById('checkin-last-name').value.trim();
            handleLookup(pnr, lastName);
        });
    }

    function populateFlightsAndPassengersStep() {
        if (!currentBookingData || !flightsListDiv || !passengersListDiv) return;
        flightsListDiv.innerHTML = `
            <div class="flight-checkin-item-vj">
                <h3>Chuyến bay ${currentBookingData.flight_number}: ${currentBookingData.departure_city} → ${currentBookingData.arrival_city}</h3>
                <p><i class="fas fa-calendar-alt"></i> Khởi hành: ${new Date(currentBookingData.departure_time).toLocaleString('vi-VN')}</p>
            </div>`;

        passengersListDiv.innerHTML = '';
        currentBookingData.passengers.forEach(pax => {
            const isCheckedIn = pax.seat_assigned && pax.seat_assigned !== '';
            const statusText = isCheckedIn ? ` (Đã check-in - Ghế ${pax.seat_assigned})` : ' (Sẵn sàng check-in)';
            passengersListDiv.innerHTML += `
                <div class="passenger-checkin-item-vj">
                    <label class="${isCheckedIn ? 'disabled' : ''}">
                        <input type="checkbox" name="selected_passengers" value="${pax.id}" ${isCheckedIn ? 'disabled' : ''}>
                        <span class="pax-name">${pax.full_name}</span> 
                        <span class="pax-status">${statusText}</span>
                    </label>
                </div>`;
        });
    }
    
    passengersSelectionForm?.addEventListener('submit', function(e) {
        e.preventDefault();
        selectedPassengerIds = Array.from(passengersListDiv.querySelectorAll('input[name="selected_passengers"]:checked')).map(cb => cb.value);
        if (selectedPassengerIds.length === 0) {
            displayError(passengerSelectionError, "Vui lòng chọn ít nhất một hành khách để làm thủ tục.");
            return;
        }
        passengerSelectionError.style.display = 'none';
        showStep('dangerousGoods');
    });

    dangerousGoodsForm?.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!confirmDGBCheckbox.checked) {
            displayError(dangerousGoodsError, "Bạn phải đồng ý với điều khoản này để tiếp tục.");
            return;
        }
        dangerousGoodsError.style.display = 'none';
        
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Đang xử lý...';

        try {
            const response = await fetch('/api/checkin/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booking_id: currentBookingData.booking_id, passenger_ids: selectedPassengerIds })
            });
            const result = await response.json();

            if (response.ok && result.success) {
                populateConfirmationStep(result.details);
                showStep('confirmation');
            } else {
                alert("Lỗi Check-in: " + (result.message || "Không thể hoàn tất thủ tục."));
            }
        } catch (error) {
            alert("Lỗi kết nối khi hoàn tất check-in. Vui lòng thử lại.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Hoàn tất thủ tục <i class="fas fa-check-circle"></i>';
        }
    });
    
    function populateConfirmationStep(checkedInDetails) {
        if (!boardingPassSummaryList || !currentBookingData) return;
        boardingPassSummaryList.innerHTML = '';
        const flightInfo = currentBookingData;

        checkedInDetails.forEach(paxDetail => {
            boardingPassSummaryList.innerHTML += `
                <div class="boarding-pass-summary-item">
                    <h4>${paxDetail.name.toUpperCase()}</h4>
                    <p><strong>Chuyến bay:</strong> ${flightInfo.flight_number}, ${flightInfo.departure_city} đến ${flightInfo.arrival_city}</p>
                    <p><strong>Ngày bay:</strong> ${new Date(flightInfo.departure_time).toLocaleDateString('vi-VN')}</p>
                    <p><strong>Giờ khởi hành:</strong> ${new Date(flightInfo.departure_time).toLocaleTimeString('vi-VN')}</p>
                    <p><strong>Ghế:</strong> ${paxDetail.seat || "N/A"}</p>
                </div>`;
        });
    }

    function autoSubmitCheckinLookup() {
        const pnrInput = document.getElementById('checkin-booking-code');
        const lastNameInput = document.getElementById('checkin-last-name');
        
        const urlParams = new URLSearchParams(window.location.search);
        const pnrFromUrl = urlParams.get('pnr');
        const lastNameFromUrl = urlParams.get('lastName');

        if (pnrInput && lastNameInput && pnrFromUrl && lastNameFromUrl) {
            pnrInput.value = pnrFromUrl;
            lastNameInput.value = lastNameFromUrl;
            
            console.log("Tự động tìm kiếm check-in...");
            handleLookup(pnrFromUrl, lastNameFromUrl);
        }
    }

    document.getElementById('btn-back-to-lookup')?.addEventListener('click', () => {
        window.location.reload(); // Tải lại trang để bắt đầu lại
    });
    document.getElementById('btn-back-to-passengers')?.addEventListener('click', () => showStep('flightsPassengers'));

    showStep('lookup');
    autoSubmitCheckinLookup();
});