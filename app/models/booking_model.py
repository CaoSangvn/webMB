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
    """
    Admin cập nhật trạng thái và ghi chú của một đặt chỗ.
    Hàm này cũng sẽ tự động cập nhật payment_status cho logic.
    """
    conn = _get_db_connection()
    try:
        # Bảng ánh xạ giữa trạng thái chính và trạng thái thanh toán tương ứng
        payment_status_map = {
            'pending_payment': 'pending',
            'confirmed': 'paid',
            'payment_received': 'paid',
            'completed': 'paid',
            'cancelled_by_user': 'refunded',    # Giả sử hủy là sẽ hoàn tiền
            'cancelled_by_airline': 'refunded', # Giả sử hủy là sẽ hoàn tiền
            'no_show': 'paid',                  # Khách không đến nhưng đã trả tiền
            'changed': 'pending'                # Đã thay đổi, có thể cần thanh toán thêm
        }
        # Dựa vào new_status được chọn, tìm ra new_payment_status tương ứng
        new_payment_status = payment_status_map.get(new_status, 'pending') # Mặc định là 'pending' nếu không tìm thấy

        # Logic xử lý ghi chú của admin (giữ nguyên như cũ)
        current_notes_row = conn.execute("SELECT notes FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        current_notes = current_notes_row['notes'] if current_notes_row and current_notes_row['notes'] else ''
        updated_notes = current_notes
        if admin_notes:
            timestamp = datetime.now().strftime('%d/%m/%Y %H:%M')
            new_note_entry = f"\n[Admin - {timestamp}]: {admin_notes}"
            updated_notes += new_note_entry

        # Cập nhật cả status và payment_status trong một câu lệnh
        cursor = conn.execute(
            "UPDATE bookings SET status = ?, payment_status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
            (new_status, new_payment_status, updated_notes.strip(), booking_id)
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

        # <<< SỬA LỖI Ở ĐÂY: TÁCH VÀ LƯU FIRST_NAME, LAST_NAME CHO HÀNH KHÁCH >>>
        for pax_data in passengers_data:
            full_name = pax_data.get('full_name', 'Hành khách').strip()
            
            # Logic tách tên: từ đầu tiên là Họ (last_name), phần còn lại là Tên (first_name)
            name_parts = full_name.split()
            last_name = name_parts[0] if name_parts else full_name
            first_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''

            conn.execute(
                """
                INSERT INTO passengers (booking_id, full_name, first_name, last_name, passenger_type) 
                VALUES (?, ?, ?, ?, ?)
                """,
                (booking_id, full_name, first_name, last_name, pax_data.get('type', 'adult'))
            )
        # <<< KẾT THÚC SỬA LỖI >>>

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
        # <<< SỬA LỖI Ở ĐÂY: Query ban đầu sẽ không lấy chi tiết hành khách ngay lập tức >>>
        # Query vẫn giữ nguyên để lấy danh sách các booking chính
        query = """
            SELECT 
                b.*, b.id as booking_id, b.status as booking_status, b.booking_code as pnr,
                f.flight_number, f.departure_time, f.arrival_time,
                dep.city as departure_city, dep.iata_code as departure_iata,
                arr.city as arrival_city, arr.iata_code as arrival_iata,
                strftime('%d/%m/%Y', f.departure_time) as flight_date_formatted
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            JOIN airports dep ON f.departure_airport_id = dep.id
            JOIN airports arr ON f.arrival_airport_id = arr.id
            WHERE b.user_id = ? ORDER BY f.departure_time DESC
        """
        bookings_raw = conn.execute(query, (user_id,)).fetchall()
        
        # <<< SỬA LỖI Ở ĐÂY: Lặp qua từng booking để lấy và đính kèm danh sách hành khách >>>
        bookings_with_passengers = []
        for booking_row in bookings_raw:
            booking_dict = dict(booking_row)
            
            # Lấy danh sách hành khách cho booking hiện tại
            passengers_raw = conn.execute(
                "SELECT * FROM passengers WHERE booking_id = ?", 
                (booking_dict['booking_id'],)
            ).fetchall()
            
            # Đính kèm danh sách hành khách vào dictionary của booking
            booking_dict['passengers'] = [dict(p) for p in passengers_raw]
            
            bookings_with_passengers.append(booking_dict)
            
        return bookings_with_passengers
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy booking của user {user_id}: {e}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()

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
    """
    Thêm các suất ăn được chọn vào một đặt chỗ hiện có.
    Hàm này sẽ tính toán chi phí phát sinh và cập nhật tổng tiền.
    """
    conn = _get_db_connection()
    try:
        # Bắt đầu một transaction để đảm bảo tất cả các thao tác đều thành công hoặc không gì cả
        conn.execute("BEGIN")

        # Bước 1: Xác thực đặt chỗ
        # Lấy thông tin cần thiết của booking và kiểm tra xem nó có thuộc về user_id này không
        booking = conn.execute(
            "SELECT id, status, ancillary_services_total, total_amount FROM bookings WHERE id = ? AND user_id = ?",
            (booking_id, user_id)
        ).fetchone()

        if not booking:
            raise ValueError("Không tìm thấy đặt chỗ hoặc bạn không có quyền thay đổi đặt chỗ này.")

        # Chỉ cho phép thêm dịch vụ vào các đặt chỗ đã xác nhận hoặc đang chờ thanh toán
        if booking['status'] not in ['confirmed', 'pending_payment', 'payment_received']:
            raise ValueError(f"Không thể thêm dịch vụ cho đặt chỗ có trạng thái '{booking['status']}'.")

        # Bước 2: Tính toán tổng chi phí các món ăn mới
        new_items_cost = 0.0
        items_to_insert = []

        for item_data in selected_items:
            menu_item_id = item_data.get('menu_item_id')
            quantity = item_data.get('quantity')
            
            # Bỏ qua nếu dữ liệu không hợp lệ
            if not menu_item_id or not isinstance(quantity, int) or quantity <= 0:
                continue

            # Lấy giá hiện tại của món ăn từ CSDL để đảm bảo tính đúng đắn
            menu_item = conn.execute("SELECT price_vnd FROM menu_items WHERE id = ? AND is_available = 1", (menu_item_id,)).fetchone()
            if not menu_item:
                raise ValueError(f"Món ăn với ID {menu_item_id} không tồn tại hoặc đã hết.")

            price_at_booking = menu_item['price_vnd']
            new_items_cost += price_at_booking * quantity
            
            # Chuẩn bị dữ liệu để chèn vào bảng trung gian
            items_to_insert.append((booking_id, menu_item_id, quantity, price_at_booking))

        if not items_to_insert:
            raise ValueError("Không có món ăn hợp lệ nào được chọn.")

        # Bước 3: Chèn các món ăn đã chọn vào bảng booking_menu_items
        conn.executemany(
            "INSERT INTO booking_menu_items (booking_id, menu_item_id, quantity, price_at_booking) VALUES (?, ?, ?, ?)",
            items_to_insert
        )

        # Bước 4: Cập nhật lại tổng tiền trong bảng bookings
        new_ancillary_total = booking['ancillary_services_total'] + new_items_cost
        new_total_amount = booking['total_amount'] + new_items_cost

        # Cập nhật tổng tiền dịch vụ, tổng tiền cuối cùng và trạng thái của booking
        conn.execute(
            """
            UPDATE bookings
            SET ancillary_services_total = ?, total_amount = ?, status = 'changed', payment_status = 'pending', updated_at = datetime('now')
            WHERE id = ?
            """,
            (new_ancillary_total, new_total_amount, booking_id)
        )

        # Bước 5: Hoàn tất transaction
        conn.commit()
        return (True, "Đã thêm các món ăn vào đặt chỗ. Vui lòng hoàn tất thanh toán.")

    except (ValueError, sqlite3.Error) as e:
        # Nếu có bất kỳ lỗi nào, hoàn tác tất cả các thay đổi trong transaction
        if conn:
            conn.rollback()
        current_app.logger.error(f"Lỗi khi thêm suất ăn cho booking {booking_id}: {e}", exc_info=True)
        # Trả về thông báo lỗi cụ thể
        return (False, str(e))
    finally:
        if conn:
            conn.close()

def get_booking_for_checkin(pnr, last_name):
    """
    Tra cứu thông tin đặt chỗ để làm thủ tục check-in.
    Hàm này trả về một dictionary có cấu trúc và thông báo lỗi bằng Tiếng Việt.
    """
    conn = _get_db_connection()
    try:
        # Dictionary để "dịch" các mã trạng thái sang Tiếng Việt
        status_vietnamese = {
            "pending_payment": "Chờ thanh toán",
            "confirmed": "Đã xác nhận",
            "cancelled_by_user": "Khách hàng đã hủy",
            "cancelled_by_airline": "Hãng đã hủy",
            "completed": "Đã hoàn thành",
            "no_show": "Không có mặt",
            "changed": "Đã thay đổi",
            "payment_received": "Đã nhận thanh toán",
            "paid": "Đã thanh toán"
        }

        # Bước 1: Tìm đặt chỗ bằng PNR
        booking_query = """
            SELECT b.id as booking_id, b.flight_id, b.status as booking_status, f.departure_time, f.status as flight_status
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            WHERE b.booking_code = ?
        """
        booking_info = conn.execute(booking_query, (pnr.upper(),)).fetchone()

        if not booking_info:
            return {"success": False, "message": "Mã đặt chỗ không tồn tại.", "reason_code": "NOT_FOUND"}

        # Bước 2: Kiểm tra họ của hành khách
        passenger_query = "SELECT 1 FROM passengers WHERE booking_id = ? AND LOWER(last_name) = LOWER(?)"
        clean_last_name = last_name.strip()
        passenger_exists = conn.execute(passenger_query, (booking_info['booking_id'], clean_last_name)).fetchone()
        
        if not passenger_exists:
            return {"success": False, "message": "Thông tin Họ của hành khách không chính xác cho Mã đặt chỗ này.", "reason_code": "INVALID_NAME"}

        # Bước 3: Kiểm tra các điều kiện check-in
        current_status_code = booking_info['booking_status']
        status_text = status_vietnamese.get(current_status_code, current_status_code) # Lấy tên TV, nếu không có thì dùng mã gốc

        if current_status_code == 'pending_payment':
            return {
                "success": False,
                "message": f"Đặt chỗ của bạn đang ở trạng thái '{status_text}'. Vui lòng thanh toán để tiếp tục.",
                "reason_code": "PENDING_PAYMENT",
                "booking_id": booking_info['booking_id']
            }

        if current_status_code not in ['confirmed', 'paid', 'payment_received']:
            return {
                "success": False,
                "message": f"Đặt chỗ của bạn đang ở trạng thái '{status_text}' và không thể làm thủ tục.",
                "reason_code": "INVALID_STATUS"
            }
        '''
        departure_dt = datetime.fromisoformat(booking_info['departure_time'])
        now_dt = datetime.now()
        time_to_departure = departure_dt - now_dt
        
        if not (timedelta(hours=1) <= time_to_departure <= timedelta(hours=24)):
            return {
                "success": False,
                "message": "Chưa đến thời gian làm thủ tục trực tuyến (chỉ mở trước 24 giờ và đóng trước 1 giờ so với giờ khởi hành).",
                "reason_code": "INVALID_TIME"
            }
        '''
        # Bước 4: Nếu mọi thứ hợp lệ, lấy thông tin chi tiết
        details_query = """
            SELECT b.id as booking_id, f.flight_number, dep.city as departure_city, arr.city as arrival_city, f.departure_time
            FROM bookings b JOIN flights f ON b.flight_id = f.id JOIN airports dep ON f.departure_airport_id = dep.id JOIN airports arr ON f.arrival_airport_id = arr.id
            WHERE b.id = ?
        """
        booking_details = conn.execute(details_query, (booking_info['booking_id'],)).fetchone()
        
        passengers_details_query = "SELECT id, full_name, seat_assigned FROM passengers WHERE booking_id = ?"
        passengers = conn.execute(passengers_details_query, (booking_info['booking_id'],)).fetchall()

        result = dict(booking_details)
        result['passengers'] = [dict(p) for p in passengers]
        
        return {"success": True, "booking_data": result}

    except Exception as e:
        current_app.logger.error(f"Lỗi khi tra cứu check-in cho PNR {pnr}: {e}", exc_info=True)
        return {"success": False, "message": "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", "reason_code": "SERVER_ERROR"}
    finally:
        if conn:
            conn.close()


def process_checkin(booking_id, passenger_ids):
    """
    Xử lý việc check-in cho các hành khách được chọn: gán số ghế và cập nhật trạng thái.
    """
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")

        checked_in_details = []
        for pax_id in passenger_ids:
            # Kiểm tra xem hành khách có thuộc booking này không và chưa check-in
            pax_info = conn.execute(
                "SELECT id, full_name FROM passengers WHERE id = ? AND booking_id = ? AND seat_assigned IS NULL",
                (pax_id, booking_id)
            ).fetchone()

            if not pax_info:
                # Bỏ qua nếu hành khách không hợp lệ hoặc đã check-in
                continue

            # Logic gán ghế đơn giản: ngẫu nhiên
            # Trong thực tế, logic này sẽ phức tạp hơn nhiều (sơ đồ ghế, loại ghế, v.v.)
            seat_number = f"{random.randint(1, 30)}{random.choice(['A', 'B', 'C', 'D', 'E', 'F'])}"
            
            # Cập nhật số ghế cho hành khách
            conn.execute("UPDATE passengers SET seat_assigned = ? WHERE id = ?", (seat_number, pax_id))
            
            checked_in_details.append({
                "id": pax_info['id'],
                "name": pax_info['full_name'],
                "seat": seat_number
            })

        if not checked_in_details:
             conn.rollback()
             return False, "Không có hành khách hợp lệ nào được chọn để làm thủ tục.", None

        # Cập nhật trạng thái check-in của cả booking
        conn.execute(
            "UPDATE bookings SET checkin_status = 'checked_in', updated_at = datetime('now') WHERE id = ?",
            (booking_id,)
        )

        conn.commit()
        return True, "Làm thủ tục thành công!", checked_in_details

    except Exception as e:
        if conn:
            conn.rollback()
        current_app.logger.error(f"Lỗi khi xử lý check-in cho booking {booking_id}: {e}", exc_info=True)
        return False, "Đã xảy ra lỗi hệ thống khi làm thủ tục.", None
    finally:
        if conn:
            conn.close()

def add_ancillary_service_to_booking(user_id, pnr, service_id):
    """
    Thêm một dịch vụ cộng thêm (ancillary service) vào một đặt chỗ hiện có.
    Hàm này sẽ tính toán chi phí phát sinh và cập nhật tổng tiền, chuyển booking sang trạng thái cần thanh toán thêm.
    """
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")

        # Bước 1: Xác thực đặt chỗ bằng PNR và user_id
        booking = conn.execute(
            "SELECT id, status, ancillary_services_total, total_amount FROM bookings WHERE booking_code = ? AND user_id = ?",
            (pnr.upper(), user_id)
        ).fetchone()

        if not booking:
            raise ValueError("Không tìm thấy Mã đặt chỗ hoặc bạn không có quyền thay đổi.")

        # Chỉ cho phép thêm dịch vụ vào các đặt chỗ đã xác nhận hoặc đã thanh toán
        if booking['status'] not in ['confirmed', 'payment_received', 'changed']:
            raise ValueError(f"Không thể thêm dịch vụ cho đặt chỗ có trạng thái '{booking['status']}'.")

        # Bước 2: Lấy thông tin và giá của dịch vụ từ bảng ancillary_services
        service = conn.execute(
            "SELECT price_vnd FROM ancillary_services WHERE id = ? AND is_available = 1",
            (service_id,)
        ).fetchone()

        if not service:
            raise ValueError("Dịch vụ không tồn tại hoặc không khả dụng.")

        # Bước 3: Tính toán chi phí và chèn vào bảng trung gian booking_ancillary_services
        price_at_booking = service['price_vnd']
        booking_id = booking['id']

        # Chèn bản ghi mới, giả sử mỗi lần chỉ thêm 1 dịch vụ (quantity = 1)
        conn.execute(
            "INSERT INTO booking_ancillary_services (booking_id, ancillary_service_id, quantity, price_at_booking) VALUES (?, ?, ?, ?)",
            (booking_id, service_id, 1, price_at_booking)
        )

        # Bước 4: Cập nhật lại tổng tiền trong bảng bookings
        new_ancillary_total = booking['ancillary_services_total'] + price_at_booking
        new_total_amount = booking['total_amount'] + price_at_booking

        # Cập nhật tổng tiền dịch vụ, tổng tiền cuối cùng và đổi trạng thái booking để yêu cầu thanh toán thêm
        conn.execute(
            """
            UPDATE bookings
            SET ancillary_services_total = ?, total_amount = ?, status = 'changed', payment_status = 'pending', updated_at = datetime('now')
            WHERE id = ?
            """,
            (new_ancillary_total, new_total_amount, booking_id)
        )
        
        conn.commit()
        return {"success": True, "booking_id": booking_id, "message": "Đã thêm dịch vụ vào đặt chỗ."}

    except (ValueError, sqlite3.Error) as e:
        if conn:
            conn.rollback()
        current_app.logger.error(f"Lỗi khi thêm dịch vụ vào PNR {pnr}: {e}", exc_info=True)
        # Trả về success: False và thông báo lỗi cụ thể
        return {"success": False, "message": str(e)}
    finally:
        if conn:
            conn.close()

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
def add_single_menu_item_to_booking(user_id, pnr, menu_item_id, quantity=1):
    """
    Thêm một món ăn duy nhất vào một đặt chỗ hiện có dựa trên PNR.
    """
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")

        # Bước 1: Xác thực đặt chỗ bằng PNR và user_id
        booking = conn.execute(
            "SELECT id, status, ancillary_services_total, total_amount FROM bookings WHERE booking_code = ? AND user_id = ?",
            (pnr, user_id)
        ).fetchone()

        if not booking:
            raise ValueError("Không tìm thấy Mã đặt chỗ hoặc bạn không có quyền thay đổi.")

        if booking['status'] not in ['confirmed', 'payment_received', 'changed']:
            raise ValueError(f"Không thể thêm dịch vụ cho đặt chỗ có trạng thái '{booking['status']}'.")

        # Bước 2: Lấy thông tin và giá của món ăn
        menu_item = conn.execute(
            "SELECT price_vnd FROM menu_items WHERE id = ? AND is_available = 1",
            (menu_item_id,)
        ).fetchone()

        if not menu_item:
            raise ValueError(f"Món ăn không tồn tại hoặc không khả dụng.")

        # Bước 3: Tính toán chi phí và chèn vào bảng trung gian
        price_at_booking = menu_item['price_vnd']
        item_cost = price_at_booking * quantity
        booking_id = booking['id']

        conn.execute(
            "INSERT INTO booking_menu_items (booking_id, menu_item_id, quantity, price_at_booking) VALUES (?, ?, ?, ?)",
            (booking_id, menu_item_id, quantity, price_at_booking)
        )

        # Bước 4: Cập nhật tổng tiền trong bảng bookings
        new_ancillary_total = booking['ancillary_services_total'] + item_cost
        new_total_amount = booking['total_amount'] + item_cost

        conn.execute(
            """
            UPDATE bookings
            SET ancillary_services_total = ?, total_amount = ?, status = 'changed', payment_status = 'pending', updated_at = datetime('now')
            WHERE id = ?
            """,
            (new_ancillary_total, new_total_amount, booking_id)
        )
        
        conn.commit()
        return {"success": True, "booking_id": booking_id, "message": "Đã thêm món ăn vào đặt chỗ."}

    except (ValueError, sqlite3.Error) as e:
        if conn:
            conn.rollback()
        current_app.logger.error(f"Lỗi khi thêm món ăn vào PNR {pnr}: {e}", exc_info=True)
        return {"success": False, "message": str(e)}
    finally:
        if conn:
            conn.close()