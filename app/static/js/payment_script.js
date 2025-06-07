// app/static/js/payment_script.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("payment_script.js loaded");

    const confirmBtn = document.getElementById('confirmPaymentBtn');
    
    // Biến bookingToPay được inject từ template payment.html
    // Nó sẽ có giá trị là booking_id hoặc null
    
    // Chỉ chạy logic nếu nút "Thanh toán" và mã đặt chỗ tồn tại
    if (confirmBtn && typeof bookingToPay !== 'undefined' && bookingToPay !== null) {
        confirmBtn.addEventListener('click', async function() {
            this.textContent = 'Đang xử lý...';
            this.disabled = true;

            try {
                const response = await fetch(`/api/payment/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ booking_id: bookingToPay })
                });
                
                const result = await response.json();

                if (response.ok && result.success) {
                    alert(result.message || "Thanh toán thành công!");
                    // Chuyển hướng đến URL server trả về, hoặc trang my_flights
                    window.location.href = result.redirect_url || "/chuyen-bay-cua-toi";
                } else {
                    alert("Lỗi: " + (result.message || "Thanh toán thất bại."));
                    this.textContent = 'Thanh toán ngay (Mô phỏng)';
                    this.disabled = false;
                }
            } catch (error) {
                alert("Lỗi kết nối. Vui lòng thử lại.");
                this.textContent = 'Thanh toán ngay (Mô phỏng)';
                this.disabled = false;
            }
        });
    }
});