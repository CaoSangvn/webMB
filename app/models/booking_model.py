# app/models/booking_model.py
import sqlite3
from flask import current_app
from datetime import datetime, timedelta
import random
import string

# =================================================================
# CÁC HÀM TIỆN ÍCH NỘI BỘ
# =================================================================

def _get_db_connection():
    """Hàm tiện ích nội bộ để lấy kết nối DB."""
    db_path = current_app.config['DATABASE_PATH']
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def _generate_pnr():
    """Tạo mã đặt chỗ (PNR) ngẫu nhiên, ví dụ: SA1A2B."""
    while True:
        prefix = "SA"
        random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        pnr = prefix + random_part
        # Kiểm tra để đảm bảo PNR là duy nhất
        conn = _get_db_connection()
        try:
            pnr_exists = conn.execute("SELECT 1 FROM bookings WHERE booking_code = ?", (pnr,)).fetchone()
            if not pnr_exists:
                return pnr
        finally:
            if conn:
                conn.close()

# =================================================================
# CÁC HÀM CHO TRANG ADMIN
# =================================================================

def get_all_bookings_admin(search_term=None, status_filter=None, flight_date_filter=None):
    """
    Lấy danh sách tất cả các đặt chỗ cho trang Admin, có hỗ trợ tìm kiếm và lọc.
    """
    conn = _get_db_connection()
    try:
        query = """
            SELECT
                b.id as booking_id,
                b.booking_code as pnr,
                COALESCE(u.full_name, p_main.full_name, 'Khách vãng lai') as passenger_name,
                u.email,
                dep.iata_code || ' → ' || arr.iata_code as itinerary,
                strftime('%Y-%m-%d', f.departure_time) as flight_date,
                b.total_amount,
                b.status as booking_status,
                strftime('%Y-%m-%d %H:%M', b.booking_time) as created_at_formatted
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            JOIN flights f ON b.flight_id = f.id
            JOIN airports dep ON f.departure_airport_id = dep.id
            JOIN airports arr ON f.arrival_airport_id = arr.id
            LEFT JOIN (SELECT booking_id, full_name FROM passengers ORDER BY id LIMIT 1) p_main ON b.id = p_main.booking_id
        """
        conditions = []
        params = []

        if search_term:
            like_term = f"%{search_term}%"
            conditions.append("(b.booking_code LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR p_main.full_name LIKE ?)")
            params.extend([like_term, like_term, like_term, like_term])

        if status_filter:
            conditions.append("b.status = ?")
            params.append(status_filter)

        if flight_date_filter:
            conditions.append("date(f.departure_time) = ?")
            params.append(flight_date_filter)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY b.booking_time DESC"

        bookings = conn.execute(query, tuple(params)).fetchall()
        return [dict(row) for row in bookings]
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy danh sách đặt chỗ cho admin: {e}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()

def get_booking_details_admin(booking_id):
    """Lấy chi tiết một đặt chỗ cho admin, bao gồm thông tin chuyến bay và hành khách."""
    conn = _get_db_connection()
    try:
        query = """
            SELECT
                b.id, b.user_id, b.flight_id, b.booking_code as pnr, b.booking_time,
                b.num_adults, b.num_children, b.num_infants, b.seat_class_booked,
                b.base_fare, b.ancillary_services_total, b.discount_applied, b.total_amount,
                b.payment_method, b.payment_status, b.status as booking_status, b.notes as admin_notes,
                f.flight_number, f.departure_time, f.arrival_time,
                dep.city as departure_city, dep.iata_code as departure_iata,
                arr.city as arrival_city, arr.iata_code as arrival_iata,
                u.full_name as user_full_name, u.email as user_email
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            JOIN airports dep ON f.departure_airport_id = dep.id
            JOIN airports arr ON f.arrival_airport_id = arr.id
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.id = ?
        """
        booking = conn.execute(query, (booking_id,)).fetchone()
        if not booking:
            return None

        booking_dict = dict(booking)

        # Định dạng lại ngày giờ cho dễ đọc
        dt_dep = datetime.fromisoformat(booking_dict['departure_time'])
        dt_arr = datetime.fromisoformat(booking_dict['arrival_time'])
        booking_dict['departure_datetime_formatted'] = dt_dep.strftime('%H:%M, %d/%m/%Y')
        booking_dict['arrival_datetime_formatted'] = dt_arr.strftime('%H:%M, %d/%m/%Y')

        # Lấy danh sách hành khách
        passengers = conn.execute("SELECT * FROM passengers WHERE booking_id = ?", (booking_id,)).fetchall()
        booking_dict['passengers'] = [dict(row) for row in passengers]

        return booking_dict
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy chi tiết booking admin (ID: {booking_id}): {e}", exc_info=True)
        return None
    finally:
        if conn:
            conn.close()

def update_booking_status_admin(booking_id, new_status, admin_notes=None):
    """Admin cập nhật trạng thái và ghi chú của một đặt chỗ."""
    conn = _get_db_connection()
    try:
        # Lấy ghi chú hiện tại
        current_notes_row = conn.execute("SELECT notes FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        current_notes = current_notes_row['notes'] if current_notes_row and current_notes_row['notes'] else ''

        updated_notes = current_notes
        if admin_notes:
            timestamp = datetime.now().strftime('%d/%m/%Y %H:%M')
            new_note_entry = f"\n[Admin - {timestamp}]: {admin_notes}"
            updated_notes += new_note_entry

        cursor = conn.execute(
            "UPDATE bookings SET status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
            (new_status, updated_notes.strip(), booking_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        if conn: conn.rollback()
        current_app.logger.error(f"Lỗi khi admin cập nhật trạng thái booking {booking_id}: {e}", exc_info=True)
        raise
    finally:
        if conn: conn.close()

def delete_booking_by_admin(booking_id):
    """Admin xóa một đặt chỗ."""
    conn = _get_db_connection()
    try:
        # Xóa các bảng liên quan trước nếu không có ON DELETE CASCADE
        conn.execute("DELETE FROM passengers WHERE booking_id = ?", (booking_id,))
        conn.execute("DELETE FROM booking_menu_items WHERE booking_id = ?", (booking_id,))
        conn.execute("DELETE FROM booking_ancillary_services WHERE booking_id = ?", (booking_id,))
        
        # Xóa đặt chỗ chính
        cursor = conn.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        if conn: conn.rollback()
        current_app.logger.error(f"Lỗi khi admin xóa booking {booking_id}: {e}", exc_info=True)
        raise
    finally:
        if conn: conn.close()

# =================================================================
# CÁC HÀM CHO TRANG CLIENT
# =================================================================

def create_booking(user_id, flight_id, passengers_data, seat_class_booked, num_adults, num_children, num_infants, payment_method, ancillary_services_cost=0.0):
    """Tạo một đặt chỗ mới cho client."""
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")

        flight = conn.execute("SELECT economy_price, business_price, first_class_price, available_seats FROM flights WHERE id = ?", (flight_id,)).fetchone()
        if not flight:
            raise ValueError("Chuyến bay không tồn tại.")

        total_passengers = num_adults + num_children
        if flight['available_seats'] < total_passengers:
            raise ValueError("Chuyến bay không còn đủ chỗ trống.")

        if seat_class_booked == "Thương gia":
            price_per_pax = flight['business_price']
        elif seat_class_booked == "Hạng nhất":
            price_per_pax = flight['first_class_price']
        else:
            price_per_pax = flight['economy_price']
        
        base_fare = price_per_pax * total_passengers
        total_amount = base_fare + ancillary_services_cost
        pnr = _generate_pnr()

        cursor = conn.execute("""
            INSERT INTO bookings (user_id, flight_id, booking_code, num_adults, num_children, num_infants, seat_class_booked, base_fare, ancillary_services_total, total_amount, payment_method, status, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'pending')
        """, (user_id, flight_id, pnr, num_adults, num_children, num_infants, seat_class_booked, base_fare, ancillary_services_cost, total_amount, payment_method))
        
        booking_id = cursor.lastrowid

        for pax_data in passengers_data:
            conn.execute("INSERT INTO passengers (booking_id, full_name, passenger_type) VALUES (?, ?, ?)",
                         (booking_id, pax_data.get('full_name', 'Hành khách'), pax_data.get('type', 'adult')))

        conn.execute("UPDATE flights SET available_seats = available_seats - ? WHERE id = ?", (total_passengers, flight_id))
        
        conn.commit()
        return {"booking_id": booking_id, "pnr": pnr, "total_amount": total_amount}
    except Exception as e:
        if conn: conn.rollback()
        current_app.logger.error(f"Lỗi khi tạo booking: {e}", exc_info=True)
        raise
    finally:
        if conn: conn.close()

def get_bookings_by_user_id(user_id):
    """Lấy tất cả đặt chỗ của một người dùng."""
    conn = _get_db_connection()
    try:
        query = """
            SELECT 
                b.*, b.status as booking_status, b.booking_code as pnr,
                f.flight_number, f.departure_time,
                dep.city as departure_city, arr.city as arrival_city,
                strftime('%H:%M %d/%m/%Y', f.departure_time) as departure_datetime_formatted
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            JOIN airports dep ON f.departure_airport_id = dep.id
            JOIN airports arr ON f.arrival_airport_id = arr.id
            WHERE b.user_id = ? ORDER BY f.departure_time DESC
        """
        bookings = conn.execute(query, (user_id,)).fetchall()
        return [dict(row) for row in bookings]
    finally:
        if conn: conn.close()

def get_booking_by_pnr_and_name(pnr, last_name, first_name):
    """Tra cứu đặt chỗ bằng PNR và tên."""
    conn = _get_db_connection()
    try:
        # Tìm booking_id từ PNR
        booking_row = conn.execute("SELECT id FROM bookings WHERE booking_code = ?", (pnr.upper(),)).fetchone()
        if not booking_row:
            return None
        booking_id = booking_row['id']

        # Kiểm tra xem có hành khách nào khớp họ và tên trong đặt chỗ đó không
        full_name_pattern = f"%{first_name}%{last_name}%"
        passenger_row = conn.execute(
            "SELECT 1 FROM passengers WHERE booking_id = ? AND (full_name LIKE ? OR (first_name = ? AND last_name = ?))",
            (booking_id, f"{last_name} {first_name}", first_name, last_name)
        ).fetchone()

        if passenger_row:
            return get_booking_details_admin(booking_id) # Dùng lại hàm chi tiết của admin
        
        return None
    finally:
        if conn: conn.close()


def process_simulated_payment(booking_id, user_id):
    """Xử lý thanh toán mô phỏng."""
    conn = _get_db_connection()
    try:
        # Kiểm tra booking thuộc về user và đang chờ thanh toán
        booking = conn.execute("SELECT id, status FROM bookings WHERE id = ? AND user_id = ?", (booking_id, user_id)).fetchone()
        if not booking or booking['status'] not in ['pending_payment', 'changed']:
            return False

        # Cập nhật trạng thái
        conn.execute("UPDATE bookings SET status = 'confirmed', payment_status = 'paid', updated_at = datetime('now') WHERE id = ?", (booking_id,))
        conn.commit()
        return True
    except Exception as e:
        if conn: conn.rollback()
        current_app.logger.error(f"Lỗi xử lý thanh toán cho booking {booking_id}: {e}", exc_info=True)
        return False
    finally:
        if conn: conn.close()

def cancel_booking_by_user(user_id, booking_id):
    """Người dùng tự hủy đặt chỗ."""
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")
        # Kiểm tra quyền sở hữu và trạng thái cho phép hủy
        booking = conn.execute(
            "SELECT flight_id, num_adults, num_children, status FROM bookings WHERE id = ? AND user_id = ?",
            (booking_id, user_id)
        ).fetchone()

        if not booking:
            raise ValueError("Không tìm thấy đặt chỗ hoặc bạn không có quyền thực hiện thao tác này.")
        
        # Chỉ cho phép hủy các vé chưa bay và chưa bị hủy
        if booking['status'] not in ['pending_payment', 'confirmed', 'payment_received']:
            raise ValueError(f"Không thể hủy đặt chỗ ở trạng thái '{booking['status']}'.")

        # Cập nhật trạng thái booking
        cursor = conn.execute("UPDATE bookings SET status = 'cancelled_by_user', updated_at = datetime('now') WHERE id = ?", (booking_id,))
        if cursor.rowcount == 0:
            raise ValueError("Không thể cập nhật trạng thái đặt chỗ.")
            
        # Hoàn trả lại số ghế đã đặt
        total_passengers = (booking['num_adults'] or 0) + (booking['num_children'] or 0)
        conn.execute(
            "UPDATE flights SET available_seats = available_seats + ? WHERE id = ?",
            (total_passengers, booking['flight_id'])
        )

        conn.commit()
        return True
    except Exception as e:
        if conn: conn.rollback()
        raise e
    finally:
        if conn: conn.close()


# Placeholder for other functions that might be needed by client_routes.py
# You should implement these based on your application's logic.

def add_menu_items_to_booking(booking_id, user_id, selected_items):
    # TODO: Implement this function
    print(f"Adding menu items for booking {booking_id} by user {user_id}: {selected_items}")
    return False, "Chức năng chưa được triển khai."

def get_booking_for_checkin(pnr, last_name):
    # TODO: Implement this function
    print(f"Looking up booking for check-in with PNR {pnr} and last name {last_name}")
    return None, "Chức năng chưa được triển khai."

def process_checkin(booking_id, passenger_ids):
    # TODO: Implement this function
    print(f"Processing check-in for booking {booking_id} with passengers {passenger_ids}")
    return False, "Chức năng chưa được triển khai.", None

def add_ancillary_service_to_booking(user_id, pnr, service_id):
    # TODO: Implement this function
    print(f"Adding ancillary service {service_id} to booking {pnr} for user {user_id}")
    return {"success": False}
def get_new_bookings_count_24h():
    """Đếm số lượng đặt chỗ được tạo trong vòng 24 giờ qua."""
    conn = _get_db_connection()
    try:
        query = "SELECT COUNT(id) as count FROM bookings WHERE booking_time >= datetime('now', '-24 hours')"
        result = conn.execute(query).fetchone()
        return result['count'] if result else 0
    finally:
        if conn: conn.close()

def get_monthly_revenue():
    """Tính tổng doanh thu từ các đặt chỗ đã thành công trong tháng hiện tại."""
    conn = _get_db_connection()
    try:
        query = """
            SELECT SUM(total_amount) as total
            FROM bookings
            WHERE status IN ('confirmed', 'payment_received', 'completed', 'paid')
            AND strftime('%Y-%m', booking_time) = strftime('%Y-%m', 'now', 'localtime')
        """
        result = conn.execute(query).fetchone()
        return result['total'] if result and result['total'] is not None else 0
    finally:
        if conn: conn.close()
def get_revenue_by_day(start_date, end_date):
    """Lấy doanh thu mỗi ngày trong một khoảng thời gian cho biểu đồ."""
    conn = _get_db_connection()
    try:
        # SỬA LỖI: Thêm COALESCE để xử lý trường hợp SUM trả về NULL
        query = """
            SELECT 
                date(booking_time) as day,
                COALESCE(SUM(total_amount), 0) as daily_revenue
            FROM bookings
            WHERE status IN ('confirmed', 'paid', 'completed', 'payment_received')
              AND date(booking_time) BETWEEN ? AND ?
            GROUP BY day
            ORDER BY day ASC;
        """
        results = conn.execute(query, (start_date, end_date)).fetchall()
        # Nếu không có ngày nào có doanh thu, query có thể trả về 1 dòng với giá trị NULL.
        # Đoạn code dưới đảm bảo chúng ta luôn trả về một danh sách các dict hợp lệ.
        if results and len(results) == 1 and results[0]['day'] is None:
            return []
            
        return [dict(row) for row in results]
    finally:
        if conn: conn.close()

def get_booking_stats_in_range(start_date, end_date):
    """Lấy các thống kê tổng hợp về đặt chỗ trong một khoảng thời gian."""
    conn = _get_db_connection()
    try:
        stats = {}
        # Thống kê trạng thái
        status_query = """
            SELECT status, COUNT(id) as count
            FROM bookings
            WHERE date(booking_time) BETWEEN ? AND ?
            GROUP BY status;
        """
        stats['status_distribution'] = [dict(row) for row in conn.execute(status_query, (start_date, end_date)).fetchall()]
        
        # Thống kê chặng bay phổ biến
        routes_query = """
            SELECT 
                dep.iata_code || ' → ' || arr.iata_code as route,
                COUNT(b.id) as count
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            JOIN airports dep ON f.departure_airport_id = dep.id
            JOIN airports arr ON f.arrival_airport_id = arr.id
            WHERE date(b.booking_time) BETWEEN ? AND ?
              AND b.status IN ('confirmed', 'paid', 'completed', 'payment_received')
            GROUP BY route
            ORDER BY count DESC
            LIMIT 5;
        """
        stats['top_routes'] = [dict(row) for row in conn.execute(routes_query, (start_date, end_date)).fetchall()]
        
        return stats
    finally:
        if conn: conn.close()

def get_new_bookings_count_24h():
    """Đếm số lượng đặt chỗ được tạo trong vòng 24 giờ qua."""
    conn = _get_db_connection()
    try:
        query = "SELECT COUNT(id) as count FROM bookings WHERE booking_time >= datetime('now', '-24 hours')"
        result = conn.execute(query).fetchone()
        return result['count'] if result else 0
    finally:
        if conn: conn.close()

def get_monthly_revenue():
    """Tính tổng doanh thu từ các đặt chỗ đã thành công trong tháng hiện tại."""
    conn = _get_db_connection()
    try:
        query = """
            SELECT SUM(total_amount) as total
            FROM bookings
            WHERE status IN ('confirmed', 'paid', 'completed', 'payment_received')
            AND strftime('%Y-%m', booking_time) = strftime('%Y-%m', 'now', 'localtime')
        """
        result = conn.execute(query).fetchone()
        return result['total'] if result and result['total'] is not None else 0
    finally:
        if conn: conn.close()
def get_revenue_by_day(start_date, end_date):
    conn = _get_db_connection()
    try:
        query = """
            SELECT date(booking_time) as day, COALESCE(SUM(total_amount), 0) as daily_revenue
            FROM bookings
            WHERE status IN ('confirmed', 'paid', 'completed', 'payment_received')
              AND date(booking_time) BETWEEN ? AND ?
            GROUP BY day ORDER BY day ASC;
        """
        results = conn.execute(query, (start_date, end_date)).fetchall()
        if results and len(results) == 1 and results[0]['day'] is None: return []
        return [dict(row) for row in results]
    finally:
        if conn: conn.close()

def get_booking_stats_in_range(start_date, end_date):
    conn = _get_db_connection()
    try:
        stats = {}
        stats['status_distribution'] = [dict(row) for row in conn.execute("SELECT status, COUNT(id) as count FROM bookings WHERE date(booking_time) BETWEEN ? AND ? GROUP BY status;", (start_date, end_date)).fetchall()]
        routes_query = """
            SELECT dep.iata_code || ' → ' || arr.iata_code as route, COUNT(b.id) as count
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            JOIN airports dep ON f.departure_airport_id = dep.id
            JOIN airports arr ON f.arrival_airport_id = arr.id
            WHERE date(b.booking_time) BETWEEN ? AND ? AND b.status IN ('confirmed', 'paid', 'completed', 'payment_received')
            GROUP BY route ORDER BY count DESC LIMIT 5;
        """
        stats['top_routes'] = [dict(row) for row in conn.execute(routes_query, (start_date, end_date)).fetchall()]
        return stats
    finally:
        if conn: conn.close()
def delete_booking_by_admin(booking_id):
    """
    Admin xóa một đặt chỗ.
    Hàm này cũng sẽ cộng lại số ghế đã đặt vào chuyến bay tương ứng.
    """
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN") # Bắt đầu một transaction

        # 1. Lấy thông tin chuyến bay và số lượng hành khách của đặt chỗ sắp xóa
        booking = conn.execute(
            "SELECT flight_id, num_adults, num_children FROM bookings WHERE id = ?",
            (booking_id,)
        ).fetchone()

        if booking:
            total_passengers = (booking['num_adults'] or 0) + (booking['num_children'] or 0)
            flight_id = booking['flight_id']
            
            # 2. Cộng lại số ghế trống cho chuyến bay
            if total_passengers > 0:
                conn.execute(
                    "UPDATE flights SET available_seats = available_seats + ? WHERE id = ?",
                    (total_passengers, flight_id)
                )

        # 3. Xóa đặt chỗ (các bản ghi liên quan trong passengers, booking_menu_items... sẽ tự xóa do ON DELETE CASCADE)
        cursor = conn.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
        
        conn.commit() # Hoàn tất transaction
        return cursor.rowcount > 0 # Trả về True nếu có 1 dòng bị ảnh hưởng (xóa thành công)
    except Exception as e:
        if conn: conn.rollback() # Hoàn tác nếu có lỗi
        current_app.logger.error(f"Lỗi khi xóa đặt chỗ {booking_id} bởi admin: {e}", exc_info=True)
        raise # Ném lỗi để controller bắt
    finally:
        if conn: conn.close()