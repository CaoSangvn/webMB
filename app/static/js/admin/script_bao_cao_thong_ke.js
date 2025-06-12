// app/static/js/admin/script_bao_cao_thong_ke.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Báo cáo & Thống kê Script Loaded - API Integrated!");

    // --- DOM Elements ---
    const totalRevenueStatEl = document.getElementById('totalRevenueStat');
    const totalBookingsStatEl = document.getElementById('totalBookingsStat');
    const activeFlightsStatEl = document.getElementById('activeFlightsStat');
    const newCustomersStatEl = document.getElementById('newCustomersStat');
    const topRoutesTableBodyEl = document.getElementById('topRoutesTableBody');
    const reportDateRangeSelect = document.getElementById('reportDateRange');
    const applyReportFilterBtn = document.getElementById('applyReportFilterBtn');

    // Chart instance (để có thể destroy và vẽ lại khi lọc)
    let bookingStatusChartInstance = null;
    
    // Mapping trạng thái để hiển thị tên tiếng Việt và màu sắc cho biểu đồ
    const statusMapping = {
        "confirmed": { text: "Đã xác nhận", color: 'rgba(40, 167, 69, 0.8)' },
        "pending_payment": { text: "Chờ thanh toán", color: 'rgba(255, 193, 7, 0.8)' },
        "payment_received": { text: "Đã thanh toán", color: 'rgba(23, 162, 184, 0.8)' },
        "cancelled_by_user": { text: "Khách hủy", color: 'rgba(220, 53, 69, 0.8)' },
        "cancelled_by_airline": { text: "Hãng hủy", color: 'rgba(108, 117, 125, 0.8)'},
        "completed": { text: "Đã hoàn thành", color: 'rgba(0, 123, 255, 0.8)' },
        "no_show": { text: "Không có mặt", color: 'rgba(52, 58, 64, 0.8)' }
    };

    // Hàm tiện ích định dạng tiền tệ
    function formatCurrency(amount) {
        if (typeof amount !== 'number') {
            return "0 VND";
        }
        return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    }

    // --- CÁC HÀM CẬP NHẬT GIAO DIỆN ---

    function updateOverviewStats(overviewData) {
        if(!overviewData) {
            console.error("Dữ liệu tổng quan không hợp lệ.");
            return;
        }
        if(totalRevenueStatEl) totalRevenueStatEl.textContent = formatCurrency(overviewData.total_revenue);
        if(totalBookingsStatEl) totalBookingsStatEl.textContent = overviewData.total_bookings || 0;
        if(activeFlightsStatEl) activeFlightsStatEl.textContent = overviewData.active_flights || 0;
        if(newCustomersStatEl) newCustomersStatEl.textContent = overviewData.new_customers || 0;
    }

    function drawBookingStatusChart(statusData) {
        const ctx = document.getElementById('bookingStatusChart')?.getContext('2d');
        if (!ctx) return;
        if (!Array.isArray(statusData)) return;

        // Hủy biểu đồ cũ trước khi vẽ mới để tránh lỗi
        if (bookingStatusChartInstance) {
            bookingStatusChartInstance.destroy();
        }
        
        // Chuẩn bị dữ liệu cho Chart.js
        const labels = statusData.map(item => statusMapping[item.status]?.text || item.status);
        const data = statusData.map(item => item.count);
        const backgroundColors = statusData.map(item => statusMapping[item.status]?.color || '#cccccc');

        bookingStatusChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số lượng đặt chỗ',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: '#fff',
                    borderWidth: 1,
                    hoverOffset: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Tỷ lệ trạng thái các đặt chỗ'
                    }
                }
            }
        });
    }
    
    function displayTopRoutes(topRoutesData) {
        if (!topRoutesTableBodyEl) return;
        topRoutesTableBodyEl.innerHTML = '';

        if (!topRoutesData || topRoutesData.length === 0) {
            topRoutesTableBodyEl.innerHTML = '<tr><td colspan="3" style="text-align:center;">Chưa có dữ liệu chặng bay.</td></tr>';
            return;
        }
        
        topRoutesData.forEach((route, index) => {
            const row = topRoutesTableBodyEl.insertRow();
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${route.itinerary}</td>
                <td>${route.booking_count}</td>
            `;
        });
    }

    // --- HÀM CHÍNH ĐỂ TẢI DỮ LIỆU VÀ CẬP NHẬT DASHBOARD ---
    async function updateDashboard() {
        const selectedDateRange = reportDateRangeSelect ? reportDateRangeSelect.value : 'last30days';
        console.log("Fetching stats for date range:", selectedDateRange);

        // Hiển thị trạng thái đang tải (tùy chọn)
        if(totalRevenueStatEl) totalRevenueStatEl.textContent = 'Đang tải...';
        if(totalBookingsStatEl) totalBookingsStatEl.textContent = '...';

        try {
            // Gọi một API duy nhất để lấy tất cả dữ liệu
            const response = await fetch(`/admin/api/stats?range=${selectedDateRange}`);
            const statsData = await response.json();
            console.log("Received stats data:", statsData);

            if (statsData.success) {
                // Gọi các hàm con để cập nhật từng phần của trang
                updateOverviewStats(statsData.overview);
                drawBookingStatusChart(statsData.bookingStatusChart);
                displayTopRoutes(statsData.topRoutes);
            } else {
                alert("Lỗi khi tải dữ liệu thống kê: " + statsData.message);
            }
        } catch (error) {
            console.error("Lỗi kết nối khi tải dữ liệu thống kê:", error);
            alert("Lỗi kết nối máy chủ.");
        }
    }

    // --- EVENT LISTENERS ---
    if (applyReportFilterBtn) {
        applyReportFilterBtn.addEventListener('click', updateDashboard);
    }
    if (reportDateRangeSelect) {
        // Có thể tự động cập nhật khi thay đổi lựa chọn
        // reportDateRangeSelect.addEventListener('change', updateDashboard);
    }

    // --- KHỞI TẠO BAN ĐẦU ---
    // Gọi hàm này lần đầu tiên khi trang tải xong để hiển thị dữ liệu mặc định ("30 ngày qua")
    updateDashboard(); 

});