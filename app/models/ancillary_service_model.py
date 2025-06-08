# app/models/ancillary_service_model.py
import sqlite3
from flask import current_app
from datetime import datetime

def _get_db_connection():
    conn = sqlite3.connect(current_app.config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def get_all_ancillary_services():
    """Lấy tất cả các dịch vụ cho trang admin."""
    conn = _get_db_connection()
    try:
        services = conn.execute("SELECT * FROM ancillary_services ORDER BY category, name").fetchall()
        return [dict(service) for service in services]
    finally:
        if conn:
            conn.close()

def get_available_services_client():
    """Lấy các dịch vụ đang khả dụng cho trang của khách hàng."""
    conn = _get_db_connection()
    try:
        services = conn.execute(
            "SELECT id, name, description, category, price_vnd, price_usd, conditions FROM ancillary_services WHERE is_available = 1 ORDER BY category, name"
        ).fetchall()
        return [dict(service) for service in services]
    finally:
        if conn:
            conn.close()

def get_ancillary_service_by_id(service_id):
    """Lấy một dịch vụ theo ID."""
    conn = _get_db_connection()
    try:
        service = conn.execute("SELECT * FROM ancillary_services WHERE id = ?", (service_id,)).fetchone()
        return dict(service) if service else None
    finally:
        if conn:
            conn.close()

def create_ancillary_service(data):
    """Tạo một dịch vụ mới."""
    conn = _get_db_connection()
    try:
        if not all(k in data and data[k] for k in ['name', 'category', 'price_vnd']):
            raise ValueError("Tên, danh mục và giá VND là bắt buộc.")

        cursor = conn.execute(
            """
            INSERT INTO ancillary_services (name, description, category, price_vnd, price_usd, conditions, is_available)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data['name'],
                data.get('description'),
                data['category'],
                float(data['price_vnd']),
                float(data['price_usd']) if data.get('price_usd') else None,
                data.get('conditions'),
                int(data.get('is_available', 1))
            )
        )
        conn.commit()
        return cursor.lastrowid
    except Exception as e:
        if conn: conn.rollback()
        raise e
    finally:
        if conn: conn.close()

def update_ancillary_service(service_id, data):
    """Cập nhật một dịch vụ."""
    conn = _get_db_connection()
    try:
        fields_to_update = []
        params = []
        possible_fields = ['name', 'description', 'category', 'price_vnd', 'price_usd', 'conditions', 'is_available']

        for field in possible_fields:
            if field in data:
                fields_to_update.append(f"{field} = ?")
                params.append(data[field])

        if not fields_to_update:
            return True

        params.append(datetime.now().isoformat())
        params.append(service_id)

        query = f"UPDATE ancillary_services SET {', '.join(fields_to_update)}, updated_at = ? WHERE id = ?"
        cursor = conn.execute(query, tuple(params))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        if conn: conn.rollback()
        raise e
    finally:
        if conn: conn.close()

def delete_ancillary_service(service_id):
    """Xóa một dịch vụ."""
    conn = _get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM ancillary_services WHERE id = ?", (service_id,))
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.IntegrityError:
        raise ValueError("Không thể xóa dịch vụ này vì đã có khách hàng đặt. Bạn có thể đánh dấu là 'Không khả dụng'.")
    except Exception as e:
        if conn: conn.rollback()
        raise e
    finally:
        if conn: conn.close()