// app/static/js/admin/script_flights.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Flights Management Script Loaded - API Integrated and Corrected!");

    // DOM Elements
    const addFlightBtn = document.getElementById('addFlightBtn');
    const flightFormModal = document.getElementById('flightFormModal');
    const closeFlightModalBtn = document.getElementById('closeFlightModalBtn');
    const flightForm = document.getElementById('flightForm');
    const flightModalTitle = document.getElementById('flightModalTitle');
    const flightsTableBody = document.getElementById('flightsTableBody');
    // saveFlightBtn không thực sự cần nếu chúng ta lắng nghe sự kiện submit của form
    const cancelFlightFormBtn = document.getElementById('cancelFlightFormBtn');
    const flightSearchInput = document.getElementById('flightSearchInput');
    const departureAirportSelect = document.getElementById('departureAirport'); // ID của select sân bay đi
    const arrivalAirportSelect = document.getElementById('arrivalAirport');   // ID của select sân bay đến
    
    const departureDateInput = document.getElementById('departureDate');
    const arrivalDateInput = document.getElementById('arrivalDate');
    const departureTimeInput = document.getElementById('departureTime'); // Dùng khi sửa
    const arrivalTimeInput = document.getElementById('arrivalTime');

    let editingFlightId = null;
    let allFlightsData = []; // Biến để lưu trữ tất cả chuyến bay từ API cho việc tìm kiếm/lọc phía client
    let currentSortColumn = null;
    let currentSortDirection = 'asc';

    // Thông tin hiển thị (có thể giữ lại hoặc tùy chỉnh nếu backend trả về tên đầy đủ)
    const statusNames = {
        "scheduled": "Lên lịch", "on-time": "Đúng giờ", "delayed": "Trễ chuyến",
        "cancelled": "Đã hủy", "departed": "Đã cất cánh", "landed": "Đã đến" // Đã sửa 'arrived' thành 'landed'
    };
    const statusClasses = {
        "scheduled": "status-scheduled", "on-time": "status-on-time", "delayed": "status-delayed",
        "cancelled": "status-cancelled", "departed": "status-departed", "landed": "status-arrived" // Đã sửa 'arrived' thành 'landed'
    };
    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Tháng bắt đầu từ 0
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
     // --- HÀM MỚI: CẬP NHẬT ICON SẮP XẾP TRÊN HEADER ---
    function updateSortIcons(clickedHeader) {
        document.querySelectorAll('#flightsTable th[data-sort-by]').forEach(th => {
            const icon = th.querySelector('i.fas');
            if (icon) {
                icon.classList.remove('fa-sort-up', 'fa-sort-down');
                icon.classList.add('fa-sort'); // Reset về icon mặc định
            }
        });

        if (clickedHeader && currentSortColumn) {
            const activeIcon = clickedHeader.querySelector('i.fas');
            if (activeIcon) {
                activeIcon.classList.remove('fa-sort');
                activeIcon.classList.add(currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            }
        }
    }
    
    // --- HÀM MỚI: SẮP XẾP DỮ LIỆU ---
    function sortData(dataArray, column, direction) {
        if (!column) return dataArray; // Không có cột nào để sắp xếp

        const sortedArray = [...dataArray]; // Tạo bản sao để không thay đổi mảng gốc

        sortedArray.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            // Xử lý giá trị null hoặc undefined để chúng luôn ở cuối khi sắp xếp tăng dần
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            // Xử lý các kiểu dữ liệu khác nhau
            if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            } else if (column.includes('_time') || column.includes('Date')) { 
                // Ưu tiên sắp xếp theo datetime gốc nếu là cột thời gian
                // API của chúng ta trả về departure_time, arrival_time là chuỗi ISO 8601
                // Chuỗi ISO 8601 có thể so sánh trực tiếp như chuỗi.
                // Nếu không, cần new Date(valA) - new Date(valB)
            } else if (typeof valA === 'number' && typeof valB === 'number') {
                // Để nguyên cho so sánh số
            }


            if (valA < valB) {
                return direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return sortedArray;
    }

    // --- HÀM MỚI: ÁP DỤNG TÌM KIẾM VÀ SẮP XẾP, SAU ĐÓ RENDER ---
    function applySearchAndSort() {
        let filteredFlights = [...allFlightsData]; // Bắt đầu với toàn bộ dữ liệu

        // Áp dụng tìm kiếm (nếu có)
        if (flightSearchInput && flightSearchInput.value) {
            const searchTerm = flightSearchInput.value.toLowerCase().trim();
            filteredFlights = allFlightsData.filter(flight => {
                return (flight.flight_number && flight.flight_number.toLowerCase().includes(searchTerm)) ||
                       (flight.departure_airport_city && flight.departure_airport_city.toLowerCase().includes(searchTerm)) ||
                       (flight.departure_airport_iata && flight.departure_airport_iata.toLowerCase().includes(searchTerm)) ||
                       (flight.arrival_airport_city && flight.arrival_airport_city.toLowerCase().includes(searchTerm)) ||
                       (flight.arrival_airport_iata && flight.arrival_airport_iata.toLowerCase().includes(searchTerm)) ||
                       (flight.departure_date_form && flight.departure_date_form.includes(searchTerm)) || // Tìm theo ngày đã định dạng
                       (flight.status && statusNames[flight.status] && statusNames[flight.status].toLowerCase().includes(searchTerm));
            });
        }
        
        // Áp dụng sắp xếp
        const sortedAndFilteredFlights = sortData(filteredFlights, currentSortColumn, currentSortDirection);
        renderFlightsTable(sortedAndFilteredFlights);
    }
    // --- FETCH DATA FROM APIs ---
    async function fetchAndPopulateAirports() {
        if (!departureAirportSelect || !arrivalAirportSelect) {
            console.warn("Các thẻ select sân bay không được tìm thấy trong modal form chuyến bay.");
            return;
        }
        try {
            const response = await fetch('/api/airports'); // API này nằm trong client_routes.py
            const data = await response.json();
            if (data.success && data.airports) {
                // Lưu giá trị đang được chọn (nếu có) để thử khôi phục sau khi điền
                const currentDeparture = departureAirportSelect.value;
                const currentArrival = arrivalAirportSelect.value;

                departureAirportSelect.innerHTML = '<option value="">-- Chọn sân bay --</option>';
                arrivalAirportSelect.innerHTML = '<option value="">-- Chọn sân bay --</option>';
                
                data.airports.forEach(airport => {
                    const optionHtml = `<option value="${airport.iata_code}">${airport.city} (${airport.iata_code}) - ${airport.name}</option>`;
                    departureAirportSelect.innerHTML += optionHtml;
                    arrivalAirportSelect.innerHTML += optionHtml;
                });
                // Thử khôi phục lựa chọn trước đó
                if (currentDeparture) departureAirportSelect.value = currentDeparture;
                if (currentArrival) arrivalAirportSelect.value = currentArrival;

            } else {
                console.error("Không tải được danh sách sân bay cho form:", data.message);
            }
        } catch (error) {
            console.error("Lỗi khi gọi API sân bay:", error);
        }
    }

    async function fetchFlights() {
        try {
            const response = await fetch('/admin/api/flights');
            const data = await response.json();
            if (data.success && data.flights) {
                allFlightsData = data.flights; // Lưu dữ liệu gốc
                applySearchAndSort();
            } else {
                if(flightsTableBody) flightsTableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;">${data.message || 'Không tải được dữ liệu chuyến bay.'}</td></tr>`;
                console.error("Không tải được danh sách chuyến bay:", data.message);
            }
        } catch (error) {
            if(flightsTableBody) flightsTableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;">Lỗi kết nối máy chủ khi tải chuyến bay.</td></tr>`;
            console.error("Lỗi khi gọi API lấy chuyến bay:", error);
        }
    }


    function renderFlightsTable(flightsToRender) {
        if (!flightsTableBody) return;
        flightsTableBody.innerHTML = ''; 
        if (!flightsToRender || flightsToRender.length === 0) {
            flightsTableBody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Không có chuyến bay nào.</td></tr>';
            return;
        }

        flightsToRender.forEach(flight => {
            const row = flightsTableBody.insertRow();
            const economyPrice = (flight.economy_price !== null && flight.economy_price !== undefined) ? flight.economy_price.toLocaleString('vi-VN') : 'N/A';
            
            row.innerHTML = `
                <td>${flight.flight_number || 'N/A'}</td>
                <td>${flight.departure_airport_city || flight.departure_airport_iata} (${flight.departure_airport_iata || 'N/A'})</td>
                <td>${flight.arrival_airport_city || flight.arrival_airport_iata} (${flight.arrival_airport_iata || 'N/A'})</td>
                <td>${flight.departure_date_form || 'N/A'}</td>
                <td>${flight.departure_time_form || 'N/A'}</td>
                <td>${flight.arrival_date_form || 'N/A'}</td>
                <td>${flight.arrival_time_form || 'N/A'}</td>
                <td>${economyPrice}</td>
                <td>${flight.total_seats !== null ? flight.total_seats : 'N/A'}</td>
                <td><span class="status ${statusClasses[flight.status] || ''}">${statusNames[flight.status] || flight.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-edit" data-flight-id="${flight.id}"><i class="fas fa-edit"></i> Sửa</button>
                    <button class="btn btn-sm btn-delete" 
                            data-flight-id="${flight.id}" 
                            data-flight-number="${flight.flight_number || 'N/A'}"><i class="fas fa-trash"></i> Xóa
                    </button>
                </td>
            `;
        });
        attachActionListenersToTable();
    }
    // --- THÊM EVENT LISTENERS CHO CÁC TIÊU ĐỀ CỘT SẮP XẾP ---
    function addSortEventListeners() {
        document.querySelectorAll('#flightsTable th[data-sort-by]').forEach(headerCell => {
            headerCell.addEventListener('click', () => {
                const sortKey = headerCell.dataset.sortBy;
                if (currentSortColumn === sortKey) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = sortKey;
                    currentSortDirection = 'asc';
                }
                updateSortIcons(headerCell);
                applySearchAndSort(); // Sắp xếp và render lại bảng
            });
        });
    }

    // --- CẬP NHẬT XỬ LÝ TÌM KIẾM ---
    if (flightSearchInput) {
        flightSearchInput.addEventListener('input', function() {
            applySearchAndSort(); // Gọi hàm mới để bao gồm cả sắp xếp
        });
    }
    // --- MODAL HANDLING ---
    async function openFlightModal(title = "Thêm chuyến bay mới", flightIdToEdit = null) {
        if (!flightFormModal || !flightModalTitle || !flightForm) {
            console.error("Modal elements (flightFormModal, flightModalTitle, flightForm) not found!");
            return;
        }
        
        flightModalTitle.textContent = title;
        flightForm.reset(); 
        editingFlightId = flightIdToEdit;
        const hiddenFlightIdInput = document.getElementById('flightId');
        if (hiddenFlightIdInput) {
            hiddenFlightIdInput.value = flightIdToEdit || '';
        }

        const flightStatusGroup = document.getElementById('flightStatusGroup');
        const todayString = getTodayDateString();

        // Lấy lại element ở đây để chắc chắn, hoặc đảm bảo chúng là biến toàn cục/trong scope đúng
        const currentDepartureDateInput = document.getElementById('departureDate'); 
        const currentArrivalDateInput = document.getElementById('arrivalDate');

        // 1. Thiết lập min cho ngày đi là ngày hôm nay
        if (currentDepartureDateInput) {
            currentDepartureDateInput.min = todayString;
        } else {
            console.error("Element 'departureDate' NOT FOUND!");
        }
        
        // 2. Thiết lập min ban đầu cho ngày đến cũng là ngày hôm nay
        //    Nó sẽ được cập nhật chính xác hơn sau khi ngày đi được điền hoặc thay đổi
        if (currentArrivalDateInput) {
            currentArrivalDateInput.min = todayString; 
        } else {
            console.error("Element 'arrivalDate' NOT FOUND!");
        }

        await fetchAndPopulateAirports(); // Đảm bảo hàm này hoạt động và điền dropdown sân bay

        if (flightIdToEdit) { 
            // --- CHẾ ĐỘ SỬA ---
            if (flightStatusGroup) flightStatusGroup.style.display = 'block';
            // hiddenFlightIdInput đã được set ở trên

            try {
                const response = await fetch(`/admin/api/flights/${flightIdToEdit}`);
                const data = await response.json();

                if (data.success && data.flight) {
                    const flightData = data.flight;
                    // Điền dữ liệu vào form
                    document.getElementById('flightNumber').value = flightData.flight_number;
                    // document.getElementById('aircraftType').value = flightData.aircraft_type || ''; // Bỏ nếu đã xóa
                    
                    if (departureAirportSelect) departureAirportSelect.value = flightData.departure_airport_iata; 
                    if (arrivalAirportSelect) arrivalAirportSelect.value = flightData.arrival_airport_iata;
                    
                    const depDateValue = flightData.departureDate || flightData.departure_date_form;
                    if (currentDepartureDateInput) currentDepartureDateInput.value = depDateValue;
                    if (departureTimeInput) departureTimeInput.value = flightData.departureTime || flightData.departure_time_form;
                    
                    const arrDateValue = flightData.arrivalDate || flightData.arrival_date_form;
                    if (currentArrivalDateInput) currentArrivalDateInput.value = arrDateValue;
                    if (arrivalTimeInput) arrivalTimeInput.value = flightData.arrivalTime || flightData.arrival_time_form;

                    // QUAN TRỌNG: Cập nhật min cho ngày đến dựa trên ngày đi được tải khi sửa
                    if (currentArrivalDateInput && depDateValue) {
                        currentArrivalDateInput.min = depDateValue;
                        // Kiểm tra nếu ngày đến hiện tại (arrDateValue) sớm hơn ngày đi (depDateValue)
                        // (Điều này không nên xảy ra nếu dữ liệu CSDL đúng, nhưng để phòng hờ)
                        if (arrDateValue && arrDateValue < depDateValue) {
                            currentArrivalDateInput.value = depDateValue; // Hoặc xóa currentArrivalDateInput.value = '';
                        }
                    }
                    
                    document.getElementById('basePrice').value = flightData.economy_price;
                    document.getElementById('totalSeats').value = flightData.total_seats;
                    document.getElementById('flightStatus').value = flightData.status; 
                } else { 
                    alert("Lỗi tải chi tiết chuyến bay: " + (data.message || "Không rõ lỗi"));
                    closeFlightModal(); return; 
                }
            } catch (error) { 
                console.error("Lỗi khi lấy chi tiết chuyến bay:", error);
                alert("Lỗi kết nối khi lấy chi tiết chuyến bay.");
                closeFlightModal(); return; 
            }
        } else { 
            // --- CHẾ ĐỘ THÊM MỚI ---
            if (flightStatusGroup) flightStatusGroup.style.display = 'none';
            // hiddenFlightIdInput đã được set value là '' ở trên
            
            // Khi thêm mới, nếu ngày đi được chọn trước đó (ví dụ form không reset hoàn toàn)
            // thì min của ngày đến phải dựa theo đó.
            if (currentDepartureDateInput && currentArrivalDateInput) {
                if (currentDepartureDateInput.value) { 
                    currentArrivalDateInput.min = currentDepartureDateInput.value;
                } else {
                    // Nếu ngày đi trống, min của ngày đến là hôm nay (đã set ở trên)
                }
            }
        }
        flightFormModal.style.display = 'block';
    }

    // --- Event Listener cho departureDateInput (ĐÃ CẬP NHẬT) ---
    // Đảm bảo departureDateInput và arrivalDateInput được khai báo ở scope ngoài
    // const departureDateInput = document.getElementById('departureDate');
    // const arrivalDateInput = document.getElementById('arrivalDate');

    if (departureDateInput && arrivalDateInput) {
        departureDateInput.addEventListener('change', function() {
            const selectedDepartureDate = this.value; // YYYY-MM-DD
            
            if (selectedDepartureDate) {
                // Đặt ngày tối thiểu cho arrivalDate là ngày đi đã chọn
                arrivalDateInput.min = selectedDepartureDate;
                
                // Nếu ngày đến hiện tại sớm hơn ngày đi mới được chọn,
                // thì xóa giá trị của ngày đến hoặc đặt nó bằng ngày đi mới.
                if (arrivalDateInput.value && arrivalDateInput.value < selectedDepartureDate) {
                    arrivalDateInput.value = selectedDepartureDate; // Hoặc arrivalDateInput.value = '';
                    // Có thể thông báo cho người dùng nếu muốn:
                    // alert("Ngày đến đã được tự động điều chỉnh để không trước ngày đi.");
                }
            } else {
                // Nếu ngày đi bị xóa (trống), reset min của ngày đến về ngày hôm nay
                arrivalDateInput.min = getTodayDateString();
            }
        });
    }

    
    function closeFlightModal() {
        if (flightFormModal) flightFormModal.style.display = 'none';
    }

    if (addFlightBtn) {
        console.log("Add Flight Button element:", addFlightBtn);
        addFlightBtn.addEventListener('click', () => openFlightModal("Thêm chuyến bay mới"));
    }
    if (closeFlightModalBtn) closeFlightModalBtn.addEventListener('click', closeFlightModal);
    if (cancelFlightFormBtn) cancelFlightFormBtn.addEventListener('click', closeFlightModal);
    window.addEventListener('click', (event) => {
        if (event.target == flightFormModal) closeFlightModal();
    });

    // --- FORM SUBMISSION (CREATE/UPDATE FLIGHT) ---
    if (flightForm) {
        flightForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const formData = new FormData(flightForm);
            const flightApiData = {
                departureAirport: formData.get('departureAirport'), // IATA code
                arrivalAirport: formData.get('arrivalAirport'),   // IATA code
                departureDate: formData.get('departureDate'),
                departureTime: formData.get('departureTime'),
                arrivalDate: formData.get('arrivalDate'),
                arrivalTime: formData.get('arrivalTime'),
                basePrice: parseInt(formData.get('basePrice')),
                totalSeats: parseInt(formData.get('totalSeats')),
            };
            if (editingFlightId) { // Nếu là sửa, thì mới lấy flightStatus từ form
                flightApiData.flightStatus = formData.get('flightStatus');
                // Nếu có trường availableSeats trong form sửa, cũng lấy ở đây
                if (formData.has('availableSeats')) { 
                    flightApiData.availableSeats = parseInt(formData.get('availableSeats'));
                }
            }

            let url = '/admin/api/flights';
            let method = 'POST';

            if (editingFlightId) {
                url = `/admin/api/flights/${editingFlightId}`;
                method = 'PUT';
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(flightApiData)
                });
                const result = await response.json();

                if (result.success) {
                    alert(result.message || (editingFlightId ? "Cập nhật chuyến bay thành công!" : "Thêm chuyến bay thành công!"));
                    fetchFlights(); 
                    closeFlightModal();
                } else {
                    alert("Lỗi: " + (result.message || "Thao tác không thành công."));
                }
            } catch (error) {
                console.error("Lỗi khi lưu chuyến bay:", error);
                alert("Lỗi kết nối máy chủ khi lưu chuyến bay.");
            }
        });
    }

    // --- ATTACH ACTION LISTENERS TO TABLE (EDIT/DELETE) ---
    // Trong app/static/js/admin/script_flights.js

    function attachActionListenersToTable() {
        if (!flightsTableBody) return;
        
        // Phần xử lý nút Sửa giữ nguyên
        flightsTableBody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', function() {
                const flightId = parseInt(this.dataset.flightId);
                openFlightModal("Chỉnh sửa thông tin chuyến bay", flightId);
            });
        });

        // Cập nhật phần xử lý nút Xóa
        flightsTableBody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async function() { 
                const flightId = parseInt(this.dataset.flightId);
                const flightNumber = this.dataset.flightNumber; // <<< LẤY SỐ HIỆU CHUYẾN BAY

                // Sử dụng flightNumber trong thông báo confirm
                if (confirm(`Bạn có chắc chắn muốn xóa chuyến bay có số hiệu ${flightNumber} không? Các đặt chỗ liên quan (nếu có) cũng sẽ bị xóa.`)) {
                    try {
                        const response = await fetch(`/admin/api/flights/${flightId}`, { method: 'DELETE' });
                        // Luôn cố gắng parse JSON, nhưng kiểm tra response.ok trước
                        if (response.ok) {
                            const result = await response.json(); 
                            if (result.success) {
                                alert(result.message || `Đã xóa chuyến bay số hiệu ${flightNumber}.`);
                                fetchFlights(); // Tải lại bảng
                            } else {
                                alert("Lỗi khi xóa: " + (result.message || "Thao tác không thành công từ server."));
                            }
                        } else {
                            let errorMsg = `Lỗi ${response.status}: ${response.statusText}.`;
                            try { 
                                const errorResult = await response.json();
                                errorMsg = errorResult.message || errorMsg;
                            } catch (e) { /* Bỏ qua nếu không parse được JSON lỗi */ }
                            alert("Lỗi khi xóa chuyến bay: " + errorMsg);
                        }
                    } catch (error) { 
                        console.error("Lỗi JavaScript khi xóa chuyến bay:", error);
                        alert("Lỗi kết nối hoặc lỗi xử lý phía client khi xóa chuyến bay.");
                    }
                }
            });
        });
    }
    
    // --- SEARCH FLIGHTS (CLIENT-SIDE SEARCH ON LOADED DATA) ---
    if (flightSearchInput) {
        flightSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            if (!allFlightsData || allFlightsData.length === 0) return;

            const filteredFlights = allFlightsData.filter(flight => {
                return (flight.flight_number && flight.flight_number.toLowerCase().includes(searchTerm)) ||
                       (flight.departure_airport_city && flight.departure_airport_city.toLowerCase().includes(searchTerm)) ||
                       (flight.departure_airport_iata && flight.departure_airport_iata.toLowerCase().includes(searchTerm)) ||
                       (flight.arrival_airport_city && flight.arrival_airport_city.toLowerCase().includes(searchTerm)) ||
                       (flight.arrival_airport_iata && flight.arrival_airport_iata.toLowerCase().includes(searchTerm)) ||
                       (flight.departure_date_form && flight.departure_date_form.includes(searchTerm));
            });
            renderFlightsTable(filteredFlights);
        });
    }

    // --- INITIALIZATION ---
    addSortEventListeners();
    fetchFlights(); // Tải danh sách chuyến bay ban đầu từ API khi trang được load
    // fetchAndPopulateAirports(); // Bạn có thể gọi ở đây một lần, hoặc gọi mỗi khi mở modal như hiện tại
});