# app/models/flight_model.py
import sqlite3
from flask import current_app
from datetime import datetime, timedelta # Để xử lý ngày tháng

def _get_db_connection():
    """Hàm tiện ích nội bộ để lấy kết nối DB."""
    conn = sqlite3.connect(current_app.config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


# app/models/flight_model.py
def search_flights(origin_airport_id, destination_airport_id, departure_date_str, 
                   passengers=1, seat_class="Phổ thông"):
    """
    Tìm kiếm các chuyến bay dựa trên điểm đi, điểm đến và NGÀY KHỞI HÀNH CHÍNH XÁC.
    Phiên bản này đã được đơn giản hóa để khắc phục lỗi không tìm thấy.
    """
    conn = _get_db_connection()
    flights_result = []
    try:
        # Bỏ logic tìm kiếm trong 7 ngày, chỉ tìm chính xác ngày được chọn
        query = """
            SELECT 
                f.id, f.flight_number, 
                f.departure_time, f.arrival_time,
                f.economy_price, f.business_price, f.first_class_price,
                f.available_seats,
                dep_airport.iata_code as origin_iata, dep_airport.city as origin_city,
                arr_airport.iata_code as destination_iata, arr_airport.city as destination_city
            FROM flights f
            JOIN airports dep_airport ON f.departure_airport_id = dep_airport.id
            JOIN airports arr_airport ON f.arrival_airport_id = arr_airport.id
            WHERE f.departure_airport_id = ?
              AND f.arrival_airport_id = ?
              AND date(f.departure_time) = ? -- <<< SỬA LỖI: Tìm chính xác ngày
              AND f.available_seats >= ?
              AND f.status = 'scheduled'
            ORDER BY f.departure_time ASC;
        """
        
        cursor = conn.execute(query, (origin_airport_id, destination_airport_id, departure_date_str, passengers))
        raw_flights = cursor.fetchall()

        for row in raw_flights:
            flight_dict = dict(row)
            # --- Logic chọn giá vé (giữ nguyên) ---
            if seat_class == "Thương gia":
                flight_dict['price'] = flight_dict['business_price']
            elif seat_class == "Hạng nhất":
                flight_dict['price'] = flight_dict['first_class_price']
            else: 
                flight_dict['price'] = flight_dict['economy_price']
            
            # --- Logic định dạng thời gian và tính duration (giữ nguyên) ---
            try:
                dt_dep = datetime.fromisoformat(flight_dict['departure_time'])
                dt_arr = datetime.fromisoformat(flight_dict['arrival_time'])
                flight_dict['departure_date_form'] = dt_dep.strftime('%Y-%m-%d')
                flight_dict['departure_time_formatted'] = dt_dep.strftime('%H:%M %d/%m/%Y')
                flight_dict['arrival_time_formatted'] = dt_arr.strftime('%H:%M %d/%m/%Y')
                
                duration = dt_arr - dt_dep
                total_seconds = duration.total_seconds()
                hours = int(total_seconds // 3600)
                minutes = int((total_seconds % 3600) // 60)

                flight_dict['duration_formatted'] = f"{hours} giờ {minutes} phút"

            except (ValueError, TypeError) as e:
                 current_app.logger.error(f"Error formatting date/time for flight {flight_dict.get('flight_number')}: {e}")
                 flight_dict['departure_date_form'] = None
                 flight_dict['departure_time_formatted'] = None
                 flight_dict['arrival_time_formatted'] = None
                 flight_dict['duration_formatted'] = "N/A"
            
            flights_result.append(flight_dict)
            
        return flights_result
    except Exception as e:
        current_app.logger.error(f"Error searching flights: {e}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()


def get_flight_details_for_booking(flight_id):
    """
    Lấy chi tiết chuyến bay cần thiết cho việc tạo booking (giá, ghế trống).
    """
    conn = _get_db_connection() # Đảm bảo _get_db_connection đã được định nghĩa trong file này
    try:
        flight = conn.execute(
            "SELECT id, economy_price, business_price, first_class_price, available_seats FROM flights WHERE id = ?",
            (flight_id,)
        ).fetchone()
        return dict(flight) if flight else None
    except Exception as e:
        print(f"Error fetching flight details for booking (ID {flight_id}): {e}")
        # current_app.logger.error(f"Error fetching flight details for booking (ID {flight_id}): {e}")
        return None
    finally:
        if conn:
            conn.close()
            
# app/models/flight_model.py
import sqlite3
from flask import current_app
from datetime import datetime

def _get_db_connection():
    conn = sqlite3.connect(current_app.config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def get_flight_details_for_booking(flight_id):
    # ... (code đã có, không thay đổi) ...
    conn = _get_db_connection()
    try:
        flight = conn.execute(
            "SELECT id, economy_price, business_price, first_class_price, available_seats FROM flights WHERE id = ?",
            (flight_id,)
        ).fetchone()
        return dict(flight) if flight else None
    except Exception as e:
        print(f"Error fetching flight details for booking (ID {flight_id}): {e}")
        return None
    finally:
        if conn: conn.close()


# --- CÁC HÀM CHO ADMIN CRUD FLIGHTS (CẬP NHẬT VÀ MỚI) ---

def combine_datetime_str(date_str, time_str):
    """Kết hợp chuỗi ngày (YYYY-MM-DD) và chuỗi giờ (HH:MM) thành chuỗi ISO datetime YYYY-MM-DD HH:MM:SS."""
    if date_str and time_str:
        # Đảm bảo có phần giây để so sánh chính xác trong SQLite
        if len(time_str) == 5: # Nếu chỉ có HH:MM
            time_str += ":00"
        return f"{date_str} {time_str}"
    return None


def create_flight(flight_data):
    """Tạo một chuyến bay mới với logic được đơn giản hóa và chính xác."""
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")

        departure_datetime_iso = combine_datetime_str(flight_data.get('departureDate'), flight_data.get('departureTime'))
        arrival_datetime_iso = combine_datetime_str(flight_data.get('arrivalDate'), flight_data.get('arrivalTime'))

        if not all([departure_datetime_iso, arrival_datetime_iso, 
                    flight_data.get('departure_airport_id'), flight_data.get('arrival_airport_id'),
                    flight_data.get('basePrice') is not None, flight_data.get('total_seats') is not None]):
            raise ValueError("Thiếu thông tin bắt buộc: sân bay, ngày giờ, giá vé hoặc số ghế.")

        total_seats = int(flight_data['total_seats'])
        
        cursor = conn.execute(
            """
            INSERT INTO flights (flight_number, departure_airport_id, arrival_airport_id, 
                                 departure_time, arrival_time, economy_price, business_price, 
                                 first_class_price, total_seats, available_seats, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                "TBA",
                flight_data['departure_airport_id'],
                flight_data['arrival_airport_id'],
                departure_datetime_iso,
                arrival_datetime_iso,
                float(flight_data['basePrice']),
                float(flight_data.get('business_price', 0)),
                float(flight_data.get('first_class_price', 0)),
                total_seats,
                total_seats,
                'scheduled'
            )
        )
        flight_id = cursor.lastrowid
        if not flight_id:
            raise sqlite3.Error("Không lấy được ID chuyến bay vừa tạo.")

        auto_flight_number = f"SA{flight_id}"
        conn.execute("UPDATE flights SET flight_number = ? WHERE id = ?", (auto_flight_number, flight_id))
        
        conn.commit()
        current_app.logger.info(f"MODEL: Đã tạo chuyến bay ID: {flight_id}, Số hiệu: {auto_flight_number}")
        return flight_id
    except (sqlite3.Error, ValueError) as e:
        if conn: conn.rollback()
        current_app.logger.error(f"MODEL: Lỗi khi tạo chuyến bay - {e}. Dữ liệu: {flight_data}", exc_info=True)
        raise
    finally:
        if conn: conn.close()

def get_all_flights_admin():
    conn = _get_db_connection()
    try:
        query = """
            SELECT 
                f.id, f.flight_number, -- Bỏ f.aircraft_type
                f.departure_time, f.arrival_time,
                f.economy_price, f.business_price, f.first_class_price,
                f.total_seats, f.available_seats, f.status,
                dep.iata_code as departure_airport_iata, dep.city as departure_airport_city,
                arr.iata_code as arrival_airport_iata, arr.city as arrival_airport_city
            FROM flights f
            LEFT JOIN airports dep ON f.departure_airport_id = dep.id
            LEFT JOIN airports arr ON f.arrival_airport_id = arr.id
            ORDER BY f.departure_time DESC;
        """
        # ... (phần xử lý results giữ nguyên, không cần xử lý aircraft_type nữa) ...
        flights = conn.execute(query).fetchall()
        results = []
        for flight in flights:
            flight_dict = dict(flight)
            try:
                dt_dep = datetime.fromisoformat(flight_dict['departure_time'])
                dt_arr = datetime.fromisoformat(flight_dict['arrival_time'])
                flight_dict['departure_date_form'] = dt_dep.strftime('%Y-%m-%d')
                flight_dict['departure_time_form'] = dt_dep.strftime('%H:%M')
                flight_dict['arrival_date_form'] = dt_arr.strftime('%Y-%m-%d')
                flight_dict['arrival_time_form'] = dt_arr.strftime('%H:%M')
            except (TypeError, ValueError): 
                flight_dict['departure_date_form'] = None
                flight_dict['departure_time_form'] = None
                flight_dict['arrival_date_form'] = None
                flight_dict['arrival_time_form'] = None
            results.append(flight_dict)
        return results
    # ... (except và finally giữ nguyên)
    except Exception as e:
        print(f"Error fetching all flights for admin: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_flight_by_id_admin(flight_id):
    conn = _get_db_connection()
    try:
        flight = conn.execute(
            """
            SELECT 
                f.id, f.flight_number, -- Bỏ f.aircraft_type
                f.departure_airport_id, f.arrival_airport_id,
                f.departure_time, f.arrival_time,
                f.economy_price, f.business_price, f.first_class_price,
                f.total_seats, f.available_seats, f.status,
                dep.iata_code as departure_airport_iata,
                arr.iata_code as arrival_airport_iata
            FROM flights f
            LEFT JOIN airports dep ON f.departure_airport_id = dep.id
            LEFT JOIN airports arr ON f.arrival_airport_id = arr.id
            WHERE f.id = ?
            """, (flight_id,)).fetchone()
        # ... (phần xử lý flight_dict giữ nguyên, không cần xử lý aircraft_type nữa) ...
        if flight:
            flight_dict = dict(flight)
            try:
                dt_dep = datetime.fromisoformat(flight_dict['departure_time'])
                dt_arr = datetime.fromisoformat(flight_dict['arrival_time'])
                flight_dict['departureDate'] = dt_dep.strftime('%Y-%m-%d')
                flight_dict['departureTime'] = dt_dep.strftime('%H:%M')
                flight_dict['arrivalDate'] = dt_arr.strftime('%Y-%m-%d')
                flight_dict['arrivalTime'] = dt_arr.strftime('%H:%M')
            except (TypeError, ValueError):
                pass 
            return flight_dict
        return None
    # ... (except và finally giữ nguyên)
    except Exception as e:
        print(f"Error fetching flight by ID {flight_id} for admin: {e}")
        return None
    finally:
        if conn:
            conn.close()

def update_flight(flight_id, flight_data):
    """Cập nhật thông tin chuyến bay với logic được làm sạch và chính xác."""
    conn = _get_db_connection()
    try:
        allowed_columns = {
            'departure_airport_id', 'arrival_airport_id', 'economy_price',
            'business_price', 'first_class_price', 'total_seats', 'available_seats', 'status'
        }
        
        fields_to_update_sql = []
        params = []
        
        if 'departureDate' in flight_data and 'departureTime' in flight_data:
            flight_data['departure_time'] = combine_datetime_str(flight_data.pop('departureDate'), flight_data.pop('departureTime'))
            allowed_columns.add('departure_time')

        if 'arrivalDate' in flight_data and 'arrivalTime' in flight_data:
            flight_data['arrival_time'] = combine_datetime_str(flight_data.pop('arrivalDate'), flight_data.pop('arrivalTime'))
            allowed_columns.add('arrival_time')

        for column_name, value in flight_data.items():
            if column_name in allowed_columns and value is not None:
                if isinstance(value, str) and not value.strip():
                    continue
                
                fields_to_update_sql.append(f"{column_name} = ?")
                params.append(value)
        
        if not fields_to_update_sql:
            current_app.logger.warning(f"Không có trường hợp lệ để cập nhật cho chuyến bay ID {flight_id}.")
            return True

        params.append(datetime.now().isoformat())
        params.append(flight_id)
        
        query = f"UPDATE flights SET {', '.join(fields_to_update_sql)}, updated_at = ? WHERE id = ?"
        
        current_app.logger.debug(f"Thực thi câu lệnh cập nhật chuyến bay: {query} với params: {tuple(params)}")
        
        conn.execute(query, tuple(params))
        conn.commit()
        return True
    except Exception as e:
        if conn: conn.rollback()
        current_app.logger.error(f"MODEL: Lỗi không mong muốn khi cập nhật chuyến bay {flight_id}: {e}", exc_info=True)
        raise
    finally:
        if conn: conn.close()

def delete_flight(flight_id):
    conn = _get_db_connection()
    current_app.logger.info(f"MODEL: Attempting to delete flight with ID: {flight_id}")
    try:
        # Kiểm tra xem chuyến bay có tồn tại không trước khi cố gắng xóa
        flight_exists_cursor = conn.execute("SELECT 1 FROM flights WHERE id = ?", (flight_id,))
        if flight_exists_cursor.fetchone() is None:
            current_app.logger.warning(f"MODEL: Flight with ID {flight_id} not found for deletion.")
            return False # Chuyến bay không tồn tại để xóa

        # Thực hiện xóa. PRAGMA foreign_keys = ON đã được set trong _get_db_connection()
        # nên ON DELETE CASCADE sẽ được kích hoạt nếu có booking liên quan.
        conn.execute("DELETE FROM flights WHERE id = ?", (flight_id,))
        conn.commit()

        current_app.logger.info(f"MODEL: Successfully executed DELETE and COMMIT for flight ID {flight_id}.")
        # Kiểm tra lại xem chuyến bay còn tồn tại không sau khi xóa
        # Đây là cách chắc chắn hơn để biết nó đã bị xóa hay chưa, thay vì dựa vào rowcount có thể không nhất quán.
        check_cursor = conn.execute("SELECT 1 FROM flights WHERE id = ?", (flight_id,))
        if check_cursor.fetchone() is None:
            current_app.logger.info(f"MODEL: Flight ID {flight_id} confirmed deleted from DB.")
            return True # Xóa thành công
        else:
            # Trường hợp này rất lạ, commit đã xong mà vẫn còn, có thể là lỗi transaction hoặc CSDL
            current_app.logger.error(f"MODEL: Flight ID {flight_id} still exists after DELETE and COMMIT. This is unexpected.")
            return False

    except sqlite3.Error as e: # Bắt tất cả các lỗi SQLite cụ thể
        current_app.logger.error(f"MODEL: SQLite error deleting flight {flight_id}: {e}")
        if conn: # Cố gắng rollback nếu có thể
            try:
                conn.rollback()
            except sqlite3.Error as rb_err:
                current_app.logger.error(f"MODEL: Error during rollback after delete failure for flight {flight_id}: {rb_err}")
        return False
    except Exception as e: # Bắt các lỗi Python khác
        current_app.logger.error(f"MODEL: Unexpected Python error deleting flight {flight_id}: {e}")
        if conn:
            try:
                conn.rollback()
            except sqlite3.Error as rb_err:
                current_app.logger.error(f"MODEL: Error during rollback after unexpected error for flight {flight_id}: {rb_err}")
        return False
    finally:
        if conn:
            conn.close()
def get_upcoming_flights_count():
    """Đếm số chuyến bay có trạng thái 'scheduled' hoặc 'on_time' từ thời điểm hiện tại trở đi."""
    conn = _get_db_connection()
    try:
        query = """
            SELECT COUNT(id) as count
            FROM flights
            WHERE departure_time >= datetime('now', 'localtime')
            AND status IN ('scheduled', 'on_time')
        """
        result = conn.execute(query).fetchone()
        return result['count'] if result else 0
    finally:
        if conn: conn.close()
def get_active_flights_count_in_range(start_date, end_date):
    conn = _get_db_connection()
    try:
        query = "SELECT COUNT(id) as count FROM flights WHERE date(departure_time) BETWEEN ? AND ? AND status IN ('scheduled', 'on_time', 'departed', 'landed')"
        result = conn.execute(query, (start_date, end_date)).fetchone()
        return result['count'] if result else 0
    finally:
        if conn: conn.close()