# app/models/booking_model.py
import sqlite3
from flask import current_app
from datetime import datetime, timedelta
import random
import string
from . import menu_item_model

def _get_db_connection():
    conn = sqlite3.connect(current_app.config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def generate_pnr(length=6):
    prefix = "SA"
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
    return prefix + random_part

def create_booking(user_id, flight_id, passengers_data, seat_class_booked,
                   num_adults, num_children, num_infants, payment_method):
    conn = _get_db_connection()
    pnr = generate_pnr()
    try:
        conn.execute("BEGIN")
        flight_details = conn.execute("SELECT economy_price, business_price, first_class_price, available_seats FROM flights WHERE id = ?", (flight_id,)).fetchone()
        if not flight_details: raise ValueError("Không tìm thấy thông tin chuyến bay.")
        
        total_passengers = num_adults + num_children
        if flight_details['available_seats'] < total_passengers: raise ValueError("Không đủ số ghế trống cho chuyến bay này.")
        
        price_map = {'Phổ thông': 'economy_price', 'Thương gia': 'business_price', 'Hạng nhất': 'first_class_price'}
        price_key = price_map.get(seat_class_booked, 'economy_price')
        price_per_passenger = flight_details[price_key]
        if price_per_passenger is None or price_per_passenger < 0: raise ValueError("Hạng ghế không hợp lệ hoặc không có giá.")

        base_fare = price_per_passenger * total_passengers
        
        booking_cursor = conn.execute(
            """INSERT INTO bookings (user_id, flight_id, booking_code, num_adults, num_children, num_infants, 
                                     seat_class_booked, base_fare, total_amount, payment_method, 
                                     payment_status, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, flight_id, pnr, num_adults, num_children, num_infants, seat_class_booked,
             base_fare, base_fare, payment_method, 'pending', 'pending_payment')
        )
        booking_id = booking_cursor.lastrowid
        if not booking_id: raise sqlite3.Error("Không thể tạo bản ghi đặt chỗ.")

        for pax_data in passengers_data:
            full_name = pax_data.get('full_name', '').strip()
            name_parts = full_name.split(' ')
            last_name = name_parts[0] if name_parts else ''
            first_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
            conn.execute("INSERT INTO passengers (booking_id, full_name, last_name, first_name, passenger_type) VALUES (?, ?, ?, ?, ?)", (booking_id, full_name, last_name, first_name, pax_data.get('type', 'adult')))
        
        conn.execute("UPDATE flights SET available_seats = available_seats - ? WHERE id = ?", (total_passengers, flight_id))
        conn.commit()
        return {"booking_id": booking_id, "pnr": pnr, "total_amount": base_fare}
    except (ValueError, sqlite3.Error) as e:
        if conn: conn.rollback()
        raise e
    finally:
        if conn: conn.close()

def format_booking_details(booking_dict):
    try:
        dt_dep = datetime.fromisoformat(booking_dict['departure_time'])
        dt_arr = datetime.fromisoformat(booking_dict['arrival_time'])
        booking_dict['departure_datetime_formatted'] = dt_dep.strftime('%H:%M, %A, %d/%m/%Y')
        booking_dict['arrival_datetime_formatted'] = dt_arr.strftime('%H:%M, %A, %d/%m/%Y')
        duration = dt_arr - dt_dep
        hours, remainder = divmod(duration.total_seconds(), 3600)
        minutes, _ = divmod(remainder, 60)
        booking_dict['duration_formatted'] = f"{int(hours)} giờ {int(minutes)} phút"
    except (ValueError, TypeError, KeyError):
        booking_dict['duration_formatted'] = "N/A"
    return booking_dict

def get_bookings_by_user_id(user_id):
    conn = _get_db_connection()
    try:
        query = """
            SELECT b.*, b.id as booking_id, b.booking_code as pnr, b.status as booking_status,
                   f.flight_number, f.departure_time, f.arrival_time,
                   dep.city as departure_city, dep.iata_code as departure_iata,
                   arr.city as arrival_city, arr.iata_code as arrival_iata
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            JOIN airports dep ON f.departure_airport_id = dep.id
            JOIN airports arr ON f.arrival_airport_id = arr.id
            WHERE b.user_id = ? ORDER BY b.booking_time DESC;
        """
        raw_bookings = conn.execute(query, (user_id,)).fetchall()
        bookings_list = []
        for row in raw_bookings:
            booking_dict = dict(row)
            passengers_raw = conn.execute("SELECT * FROM passengers WHERE booking_id = ?", (booking_dict['booking_id'],)).fetchall()
            booking_dict['passengers'] = [dict(p) for p in passengers_raw]
            bookings_list.append(format_booking_details(booking_dict))
        return bookings_list
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy booking của user {user_id}: {e}", exc_info=True)
        return []
    finally:
        if conn: conn.close()

def get_booking_by_pnr_and_name(pnr_code, last_name, first_name):
    conn = _get_db_connection()
    try:
        query = "SELECT b.*, b.id as booking_id, b.booking_code as pnr, b.status as booking_status, f.flight_number, f.departure_time, f.arrival_time, dep.city as departure_city, dep.iata_code as departure_iata, arr.city as arrival_city, arr.iata_code as arrival_iata, u.full_name as booker_full_name, u.email as booker_email FROM bookings b JOIN flights f ON b.flight_id = f.id JOIN airports dep ON f.departure_airport_id = dep.id JOIN airports arr ON f.arrival_airport_id = arr.id LEFT JOIN users u ON b.user_id = u.id WHERE b.booking_code = ?"
        booking_row = conn.execute(query, (pnr_code.upper(),)).fetchone()
        if not booking_row: return None
        booking_dict = dict(booking_row)
        passenger_exists = conn.execute("SELECT 1 FROM passengers WHERE booking_id = ? AND UPPER(last_name) = ? AND UPPER(first_name) = ? LIMIT 1;", (booking_dict['booking_id'], last_name.upper(), first_name.upper())).fetchone()
        if not passenger_exists: return None
        passengers_raw = conn.execute("SELECT * FROM passengers WHERE booking_id = ?", (booking_dict['booking_id'],)).fetchall()
        booking_dict['passengers'] = [dict(p) for p in passengers_raw]
        return format_booking_details(booking_dict)
    except Exception as e:
        current_app.logger.error(f"Lỗi khi tra cứu PNR {pnr_code}: {e}", exc_info=True)
        return None
    finally:
        if conn: conn.close()

def get_booking_details_admin(booking_id):
    conn = _get_db_connection()
    try:
        query = "SELECT b.*, b.id as booking_id, b.booking_code as pnr, b.status as booking_status, f.flight_number, f.departure_time, f.arrival_time, dep.name as departure_airport_name, dep.city as departure_city, dep.iata_code as departure_iata, arr.name as arrival_airport_name, arr.city as arrival_city, arr.iata_code as arrival_iata, u.full_name as booker_full_name, u.email as booker_email, u.phone_number as booker_phone FROM bookings b JOIN flights f ON b.flight_id = f.id JOIN airports dep ON f.departure_airport_id = dep.id JOIN airports arr ON f.arrival_airport_id = arr.id LEFT JOIN users u ON b.user_id = u.id WHERE b.id = ?;"
        booking_row = conn.execute(query, (booking_id,)).fetchone()
        if not booking_row: return None
        booking_dict = dict(booking_row)
        passengers_raw = conn.execute("SELECT * FROM passengers WHERE booking_id = ?", (booking_id,)).fetchall()
        booking_dict['passengers'] = [dict(p) for p in passengers_raw]
        return format_booking_details(booking_dict)
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy chi tiết booking admin (ID {booking_id}): {e}", exc_info=True)
        return None
    finally:
        if conn: conn.close()

def add_menu_items_to_booking(booking_id, user_id, selected_items):
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")
        booking = conn.execute("SELECT id, base_fare, discount_applied FROM bookings WHERE id = ? AND user_id = ?", (booking_id, user_id)).fetchone()
        if not booking: raise ValueError("Không tìm thấy đặt chỗ hoặc bạn không có quyền.")
        total_new_meal_cost = 0
        conn.execute("DELETE FROM booking_menu_items WHERE booking_id = ?", (booking_id,))
        for item in selected_items:
            menu_item_id = item.get('menu_item_id')
            quantity = item.get('quantity')
            if not menu_item_id or not isinstance(quantity, int) or quantity <= 0: continue
            menu_item_details = menu_item_model.get_menu_item_by_id(menu_item_id)
            if not menu_item_details: raise ValueError(f"Món ăn ID {menu_item_id} không tồn tại.")
            if not menu_item_details.get('is_available'): raise ValueError(f"Món '{menu_item_details.get('name')}' không khả dụng.")
            price_at_booking = menu_item_details.get('price_vnd', 0)
            total_new_meal_cost += price_at_booking * quantity
            conn.execute("INSERT INTO booking_menu_items (booking_id, menu_item_id, quantity, price_at_booking) VALUES (?, ?, ?, ?)", (booking_id, menu_item_id, quantity, price_at_booking))
        
        base_fare = booking['base_fare'] or 0
        discount = booking['discount_applied'] or 0
        new_total_amount = base_fare + total_new_meal_cost - discount
        
        conn.execute("UPDATE bookings SET ancillary_services_total = ?, total_amount = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", (total_new_meal_cost, new_total_amount, booking_id))
        conn.commit()
        return True, "Thêm suất ăn và cập nhật đặt chỗ thành công."
    except (ValueError, sqlite3.Error) as e:
        if conn: conn.rollback()
        current_app.logger.error(f"MODEL: Lỗi khi thêm suất ăn cho booking {booking_id}: {e}", exc_info=True)
        return False, str(e)
    finally:
        if conn: conn.close()

def process_simulated_payment(booking_id, user_id):
    conn = _get_db_connection()
    try:
        booking = conn.execute("SELECT id FROM bookings WHERE id = ? AND user_id = ?", (booking_id, user_id)).fetchone()
        if not booking: raise ValueError("Đặt chỗ không hợp lệ.")
        cursor = conn.execute("UPDATE bookings SET status = 'confirmed', payment_status = 'paid', updated_at = datetime('now', 'localtime') WHERE id = ?", (booking_id,))
        conn.commit()
        return cursor.rowcount > 0
    except (ValueError, sqlite3.Error) as e:
        if conn: conn.rollback()
        current_app.logger.error(f"MODEL: Lỗi khi xử lý thanh toán cho booking {booking_id}: {e}", exc_info=True)
        return False
    finally:
        if conn: conn.close()

def get_booking_for_checkin(pnr_code, last_name):
    conn = _get_db_connection()
    try:
        query = "SELECT b.id as booking_id, b.booking_code as pnr, b.status as booking_status, f.id as flight_id, f.departure_time, dep.city as departure_city, arr.city as arrival_city, f.flight_number FROM bookings b JOIN flights f ON b.flight_id = f.id JOIN airports dep ON f.departure_airport_id = dep.id JOIN airports arr ON f.arrival_airport_id = arr.id WHERE b.booking_code = ?;"
        booking_row = conn.execute(query, (pnr_code.upper(),)).fetchone()
        if not booking_row: return None, "Không tìm thấy mã đặt chỗ."
        
        booking_dict = dict(booking_row)
        
        passengers_raw = conn.execute("SELECT * FROM passengers WHERE booking_id = ? AND UPPER(last_name) = ?", (booking_dict['booking_id'], last_name.upper())).fetchall()
        if not passengers_raw: return None, "Thông tin họ của hành khách không chính xác cho mã đặt chỗ này."
        
        if booking_dict['booking_status'] != 'confirmed': return None, f"Chuyến bay này không thể làm thủ tục. Trạng thái hiện tại: {booking_dict['booking_status']}."
        
        # === BỎ QUA KIỂM TRA THỜI GIAN CHECK-IN ===
        # departure_time = datetime.fromisoformat(booking_dict['departure_time'])
        # time_now = datetime.now()
        # time_diff = departure_time - time_now
        # 
        # if not (timedelta(hours=1) <= time_diff <= timedelta(hours=24)):
        #     return None, "Chỉ được làm thủ tục trong khoảng từ 24 tiếng đến 1 tiếng trước giờ khởi hành."
        # ==========================================

        all_passengers_raw = conn.execute("SELECT * FROM passengers WHERE booking_id = ?", (booking_dict['booking_id'],)).fetchall()
        booking_dict['passengers'] = [dict(p) for p in all_passengers_raw]
        return booking_dict, "Tìm thấy đặt chỗ hợp lệ."
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy booking cho check-in (PNR {pnr_code}): {e}", exc_info=True)
        return None, "Lỗi máy chủ khi tra cứu."
    finally:
        if conn: conn.close()

def process_checkin(booking_id, passenger_ids):
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")
        flight_id_row = conn.execute("SELECT flight_id FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        if not flight_id_row: raise ValueError("Không tìm thấy chuyến bay cho đặt chỗ này.")
        flight_id = flight_id_row['flight_id']

        existing_seats_cursor = conn.execute("SELECT p.seat_assigned FROM passengers p JOIN bookings b ON p.booking_id = b.id WHERE b.flight_id = ? AND p.seat_assigned IS NOT NULL", (flight_id,))
        existing_seats = {row['seat_assigned'] for row in existing_seats_cursor.fetchall()}
        
        passengers_to_checkin = conn.execute(f"SELECT id, full_name FROM passengers WHERE id IN ({','.join('?' for _ in passenger_ids)})", tuple(passenger_ids)).fetchall()
        checked_in_details = []
        seat_counter = 1
        seat_row = 'A'
        
        for pax in passengers_to_checkin:
            assigned_seat = None
            for _ in range(300):
                new_seat = f"{seat_counter}{seat_row}"
                if new_seat not in existing_seats:
                    assigned_seat = new_seat
                    existing_seats.add(new_seat)
                    break
                if seat_row == 'F':
                    seat_row = 'A'
                    seat_counter += 1
                else:
                    seat_row = chr(ord(seat_row) + 1)
            
            if not assigned_seat: raise Exception("Không thể tìm thấy ghế trống.")

            conn.execute("UPDATE passengers SET seat_assigned = ? WHERE id = ?", (assigned_seat, pax['id']))
            checked_in_details.append({"name": pax['full_name'], "seat": assigned_seat})

        conn.execute("UPDATE bookings SET checkin_status = 'checked_in' WHERE id = ?", (booking_id,))
        conn.commit()
        return True, "Check-in thành công!", checked_in_details
    except Exception as e:
        if conn: conn.rollback()
        current_app.logger.error(f"Lỗi khi xử lý check-in cho booking {booking_id}: {e}", exc_info=True)
        return False, "Lỗi máy chủ khi xử lý check-in.", None
    finally:
        if conn: conn.close()