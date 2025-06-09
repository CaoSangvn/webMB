# app/models/flight_model.py
import sqlite3
from flask import current_app
from datetime import datetime, timedelta

# --- HÀM HELPER ---

def _get_db_connection():
    """Hàm tiện ích nội bộ để lấy kết nối DB."""
    conn = sqlite3.connect(current_app.config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def combine_datetime_str(date_str, time_str):
    """Kết hợp chuỗi ngày (YYYY-MM-DD) và chuỗi giờ (HH:MM) thành chuỗi ISO datetime."""
    if date_str and time_str:
        if len(time_str) == 5:
            time_str += ":00"
        return f"{date_str} {time_str}"
    return None

# --- HÀM CHO CLIENT ---

def search_flights(origin_airport_id, destination_airport_id, departure_date_str, 
                   passengers=1, seat_class="Phổ thông"):
    """
    Tìm kiếm các chuyến bay dựa trên điểm đi, điểm đến và ngày khởi hành.
    Sử dụng phương pháp so sánh khoảng thời gian để đảm bảo độ chính xác.
    """
    conn = _get_db_connection()
    flights_result = []
    try:
        start_of_day = datetime.fromisoformat(departure_date_str + ' 00:00:00')
        end_of_day = start_of_day + timedelta(days=1)

        query = """
            SELECT 
                f.id, f.flight_number, f.departure_time, f.arrival_time,
                f.economy_price, f.business_price, f.first_class_price,
                f.available_seats,
                dep.iata_code as origin_iata, dep.city as origin_city,
                arr.iata_code as destination_iata, arr.city as destination_city
            FROM flights f
            JOIN airports dep ON f.departure_airport_id = dep.id
            JOIN airports arr ON f.arrival_airport_id = arr.id
            WHERE f.departure_airport_id = ?
              AND f.arrival_airport_id = ?
              AND f.departure_time >= ?
              AND f.departure_time < ?
              AND f.available_seats >= ?
              AND f.status = 'scheduled'
            ORDER BY f.departure_time ASC;
        """
        params = (origin_airport_id, destination_airport_id, 
                  start_of_day.strftime('%Y-%m-%d %H:%M:%S'), 
                  end_of_day.strftime('%Y-%m-%d %H:%M:%S'), 
                  passengers)
        
        cursor = conn.execute(query, params)
        raw_flights = cursor.fetchall()

        for row in raw_flights:
            flight_dict = dict(row)
            if seat_class == "Thương gia":
                flight_dict['price'] = flight_dict['business_price']
            elif seat_class == "Hạng nhất":
                flight_dict['price'] = flight_dict['first_class_price']
            else:
                flight_dict['price'] = flight_dict['economy_price']
            
            try:
                dt_dep = datetime.fromisoformat(flight_dict['departure_time'])
                dt_arr = datetime.fromisoformat(flight_dict['arrival_time'])
                flight_dict['departure_time_formatted'] = dt_dep.strftime('%H:%M, %d/%m/%Y')
                flight_dict['arrival_time_formatted'] = dt_arr.strftime('%H:%M, %d/%m/%Y')
                duration = dt_arr - dt_dep
                hours = int(duration.total_seconds() // 3600)
                minutes = int((duration.total_seconds() % 3600) // 60)
                flight_dict['duration_formatted'] = f"{hours} giờ {minutes} phút"
            except (ValueError, TypeError) as e:
                current_app.logger.error(f"Error formatting date/time: {e}")
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
    """Lấy chi tiết chuyến bay cần thiết cho việc tạo booking."""
    conn = _get_db_connection()
    try:
        flight = conn.execute(
            "SELECT id, economy_price, business_price, first_class_price, available_seats FROM flights WHERE id = ?",
            (flight_id,)
        ).fetchone()
        return dict(flight) if flight else None
    except Exception as e:
        current_app.logger.error(f"Error fetching flight details for booking ID {flight_id}: {e}")
        return None
    finally:
        if conn:
            conn.close()

# --- HÀM CHO ADMIN ---

def create_flight(flight_data):
    """Tạo một chuyến bay mới."""
    conn = _get_db_connection()
    try:
        conn.execute("BEGIN")
        departure_datetime_iso = combine_datetime_str(flight_data.get('departureDate'), flight_data.get('departureTime'))
        arrival_datetime_iso = combine_datetime_str(flight_data.get('arrivalDate'), flight_data.get('arrivalTime'))

        if not all([departure_datetime_iso, arrival_datetime_iso, flight_data.get('departure_airport_id'), flight_data.get('arrival_airport_id'), flight_data.get('basePrice') is not None, flight_data.get('total_seats') is not None]):
            raise ValueError("Thiếu thông tin bắt buộc: sân bay, ngày giờ, giá vé hoặc số ghế.")

        total_seats = int(flight_data['total_seats'])
        cursor = conn.execute(
            """
            INSERT INTO flights (flight_number, departure_airport_id, arrival_airport_id, departure_time, arrival_time, economy_price, business_price, first_class_price, total_seats, available_seats, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            ("TBA", flight_data['departure_airport_id'], flight_data['arrival_airport_id'], departure_datetime_iso, arrival_datetime_iso, float(flight_data['basePrice']), float(flight_data.get('business_price', 0)), float(flight_data.get('first_class_price', 0)), total_seats, total_seats, 'scheduled')
        )
        flight_id = cursor.lastrowid
        auto_flight_number = f"SA{flight_id}"
        conn.execute("UPDATE flights SET flight_number = ? WHERE id = ?", (auto_flight_number, flight_id))
        conn.commit()
        return flight_id
    except (sqlite3.Error, ValueError) as e:
        if conn: conn.rollback()
        current_app.logger.error(f"MODEL: Lỗi khi tạo chuyến bay - {e}", exc_info=True)
        raise
    finally:
        if conn: conn.close()

def get_all_flights_admin():
    """Lấy tất cả chuyến bay cho trang admin."""
    conn = _get_db_connection()
    try:
        query = """
            SELECT f.id, f.flight_number, f.departure_time, f.arrival_time, f.economy_price, f.business_price, f.first_class_price, f.total_seats, f.available_seats, f.status, dep.iata_code as departure_airport_iata, dep.city as departure_airport_city, arr.iata_code as arrival_airport_iata, arr.city as arrival_airport_city
            FROM flights f
            LEFT JOIN airports dep ON f.departure_airport_id = dep.id
            LEFT JOIN airports arr ON f.arrival_airport_id = arr.id
            ORDER BY f.departure_time DESC;
        """
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
                pass
            results.append(flight_dict)
        return results
    except Exception as e:
        current_app.logger.error(f"Error fetching all flights for admin: {e}")
        return []
    finally:
        if conn: conn.close()

def get_flight_by_id_admin(flight_id):
    """Lấy chi tiết một chuyến bay cho admin."""
    conn = _get_db_connection()
    try:
        flight = conn.execute("SELECT f.id, f.flight_number, f.departure_airport_id, f.arrival_airport_id, f.departure_time, f.arrival_time, f.economy_price, f.business_price, f.first_class_price, f.total_seats, f.available_seats, f.status, dep.iata_code as departure_airport_iata, arr.iata_code as arrival_airport_iata FROM flights f LEFT JOIN airports dep ON f.departure_airport_id = dep.id LEFT JOIN airports arr ON f.arrival_airport_id = arr.id WHERE f.id = ?", (flight_id,)).fetchone()
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
    except Exception as e:
        current_app.logger.error(f"Error fetching flight by ID {flight_id} for admin: {e}")
        return None
    finally:
        if conn: conn.close()

def update_flight(flight_id, flight_data):
    """Cập nhật thông tin chuyến bay."""
    conn = _get_db_connection()
    try:
        fields_to_update_sql = []
        params = []
        allowed_columns = {'departure_airport_id', 'arrival_airport_id', 'economy_price', 'business_price', 'first_class_price', 'total_seats', 'available_seats', 'status'}
        if 'departureDate' in flight_data and 'departureTime' in flight_data:
            flight_data['departure_time'] = combine_datetime_str(flight_data.pop('departureDate'), flight_data.pop('departureTime'))
            allowed_columns.add('departure_time')
        if 'arrivalDate' in flight_data and 'arrivalTime' in flight_data:
            flight_data['arrival_time'] = combine_datetime_str(flight_data.pop('arrivalDate'), flight_data.pop('arrivalTime'))
            allowed_columns.add('arrival_time')

        for col, val in flight_data.items():
            if col in allowed_columns and val is not None:
                if isinstance(val, str) and not val.strip(): continue
                fields_to_update_sql.append(f"{col} = ?")
                params.append(val)
        
        if not fields_to_update_sql: return True
        params.append(datetime.now().isoformat())
        params.append(flight_id)
        query = f"UPDATE flights SET {', '.join(fields_to_update_sql)}, updated_at = ? WHERE id = ?"
        conn.execute(query, tuple(params))
        conn.commit()
        return True
    except Exception as e:
        if conn: conn.rollback()
        raise
    finally:
        if conn: conn.close()

def delete_flight(flight_id):
    """Xóa một chuyến bay."""
    conn = _get_db_connection()
    try:
        conn.execute("DELETE FROM flights WHERE id = ?", (flight_id,))
        conn.commit()
        return True
    except sqlite3.Error as e:
        if conn: conn.rollback()
        current_app.logger.error(f"MODEL: SQLite error deleting flight {flight_id}: {e}")
        return False
    finally:
        if conn: conn.close()
        
def get_upcoming_flights_count():
    """Đếm số chuyến bay sắp tới."""
    conn = _get_db_connection()
    try:
        query = "SELECT COUNT(id) as count FROM flights WHERE departure_time >= datetime('now', 'localtime') AND status IN ('scheduled', 'on_time')"
        result = conn.execute(query).fetchone()
        return result['count'] if result else 0
    finally:
        if conn: conn.close()