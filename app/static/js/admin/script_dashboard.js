// app/static/js/admin/script_dashboard.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Admin Dashboard Script Loaded! Fetching dynamic data...");

    async function fetchDashboardStats() {
        try {
            // Gọi API backend để lấy dữ liệu
            const response = await fetch('/admin/api/dashboard/stats');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (data.success && data.stats) {
                const stats = data.stats;

                // Lấy các DOM element
                const upcomingFlightsEl = document.getElementById('upcoming-flights-count');
                const newBookingsEl = document.getElementById('new-bookings-count');
                const newUsersEl = document.getElementById('new-users-count');
                const monthlyRevenueEl = document.getElementById('monthly-revenue');

                // Cập nhật giao diện
                if (upcomingFlightsEl) upcomingFlightsEl.textContent = stats.upcoming_flights;
                if (newBookingsEl) newBookingsEl.textContent = stats.new_bookings_24h;
                if (newUsersEl) newUsersEl.textContent = stats.new_users_24h;
                
                // Định dạng lại doanh thu cho dễ đọc
                if (monthlyRevenueEl) {
                    const revenue = stats.monthly_revenue || 0;
                    if (revenue >= 1000000) {
                        // Hiển thị dạng "150.5 Tr"
                        monthlyRevenueEl.textContent = `${(revenue / 1000000).toFixed(1).replace(/\.0$/, '')} Tr`;
                    } else if (revenue >= 1000) {
                        // Hiển thị dạng "150 K"
                        monthlyRevenueEl.textContent = `${Math.round(revenue / 1000)} K`;
                    } else {
                        monthlyRevenueEl.textContent = revenue.toLocaleString('vi-VN');
                    }
                }
            } else {
                console.error("Failed to fetch dashboard stats:", data.message);
                // Có thể hiển thị "Lỗi" trên các card
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            // Hiển thị "Lỗi" trên các card khi có lỗi kết nối
            document.getElementById('upcoming-flights-count').textContent = "Lỗi";
            document.getElementById('new-bookings-count').textContent = "Lỗi";
            document.getElementById('new-users-count').textContent = "Lỗi";
            document.getElementById('monthly-revenue').textContent = "Lỗi";
        }
    }

    // Gọi hàm để tải dữ liệu khi trang được load
    fetchDashboardStats();
});