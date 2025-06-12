# app/models/client_model.py
import sqlite3
from flask import current_app
from werkzeug.security import generate_password_hash, check_password_hash

def _get_db_connection():
    conn = sqlite3.connect(current_app.config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def create_user(full_name, email, password, phone_number=None):
    """
    Client tự đăng ký tài khoản.
    CẢI TIẾN: Xử lý lỗi cụ thể và sử dụng transaction rõ ràng.
    """
    hashed_password = generate_password_hash(password)
    conn = _get_db_connection()
    try:
        # Bắt đầu transaction một cách rõ ràng
        conn.execute("BEGIN")
        
        cursor = conn.execute(
            "INSERT INTO users (full_name, email, password_hash, phone_number, role, status) VALUES (?, ?, ?, ?, ?, ?)",
            (full_name, email, hashed_password, phone_number, 'client', 'active')
        )
        
        # Hoàn tất transaction
        conn.commit()
        return cursor.lastrowid
        
    except sqlite3.IntegrityError as e:
        # Hoàn tác transaction nếu có lỗi
        if conn:
            conn.rollback()
        
        # Phân tích lỗi để đưa ra thông báo cụ thể hơn
        error_msg = str(e).lower()
        if "unique constraint failed: users.email" in error_msg:
            raise ValueError(f"Email '{email}' đã được đăng ký.")
        elif "unique constraint failed: users.phone_number" in error_msg:
            raise ValueError(f"Số điện thoại '{phone_number}' đã được sử dụng.")
        else:
            # Cho các lỗi ràng buộc khác không lường trước
            raise ValueError(f"Lỗi ràng buộc dữ liệu: {e}")

    except Exception as e:
        # Hoàn tác transaction cho các lỗi khác
        if conn:
            conn.rollback()
        current_app.logger.error(f"Lỗi không xác định khi tạo người dùng {email}: {e}", exc_info=True)
        # Ném lại lỗi để controller ở trên có thể bắt và trả về lỗi 500
        raise
        
    finally:
        if conn:
            conn.close()

# =================================================================
# CÁC HÀM KHÁC ĐƯỢC GIỮ NGUYÊN
# =================================================================

def get_user_by_email(email):
    conn = _get_db_connection()
    try:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return user
    finally:
        if conn:
            conn.close()

def get_user_by_id(user_id):
    conn = _get_db_connection()
    try:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return user
    finally:
        if conn:
            conn.close()
            
def get_all_users_admin(search_term=None, status_filter=None, role_filter=None):
    """
    Lấy danh sách người dùng cho admin, có tìm kiếm, lọc.
    """
    conn = _get_db_connection()
    try:
        query_params = []
        base_query = "SELECT id, full_name, email, phone_number, role, status, strftime('%Y-%m-%d', created_at) as registered_date FROM users"
        conditions = []

        if search_term:
            like_term = f"%{search_term}%"
            conditions.append("(full_name LIKE ? OR email LIKE ? OR phone_number LIKE ?)")
            query_params.extend([like_term, like_term, like_term])
        
        if status_filter:
            conditions.append("status = ?")
            query_params.append(status_filter)

        if role_filter:
            conditions.append("role = ?")
            query_params.append(role_filter)

        if conditions:
            base_query += " WHERE " + " AND ".join(conditions)
        
        base_query += " ORDER BY created_at DESC"
        
        cursor = conn.execute(base_query, tuple(query_params))
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        current_app.logger.error(f"Error fetching all users for admin: {e}")
        return []
    finally:
        if conn:
            conn.close()

def create_user_by_admin(user_data):
    """
    Admin tạo người dùng mới.
    """
    if not user_data.get('password'):
        raise ValueError("Mật khẩu là bắt buộc khi tạo người dùng mới.")
        
    hashed_password = generate_password_hash(user_data['password'])
    conn = _get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO users (full_name, email, password_hash, phone_number, role, status) VALUES (?, ?, ?, ?, ?, ?)",
            (user_data['full_name'], user_data['email'], hashed_password, 
             user_data.get('phone_number'), user_data.get('role', 'client'), user_data.get('status', 'active'))
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as ie:
        raise ie
    finally:
        if conn:
            conn.close()

def update_user_by_admin(user_id, user_data):
    """
    Admin cập nhật thông tin người dùng.
    """
    conn = _get_db_connection()
    fields_to_update_sql = []
    params = []

    possible_fields = ['full_name', 'email', 'phone_number', 'role', 'status']
    for field in possible_fields:
        if field in user_data and user_data[field] is not None:
            fields_to_update_sql.append(f"{field} = ?")
            params.append(user_data[field])
    
    if 'password' in user_data and user_data['password']: 
        if len(user_data['password']) < 6:
             raise ValueError("Mật khẩu mới phải có ít nhất 6 ký tự.")
        hashed_password = generate_password_hash(user_data['password'])
        fields_to_update_sql.append("password_hash = ?")
        params.append(hashed_password)

    if not fields_to_update_sql:
        return True

    params.append(user_id)
    query = f"UPDATE users SET {', '.join(fields_to_update_sql)}, updated_at = datetime('now', 'localtime') WHERE id = ?"
    
    try:
        conn.execute(query, tuple(params))
        conn.commit()
        return True
    except sqlite3.IntegrityError as ie:
        raise ie
    finally:
        if conn:
            conn.close()

def delete_user_by_admin(user_id):
    """Admin xóa người dùng."""
    conn = _get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        return cursor.rowcount > 0 
    except sqlite3.IntegrityError as ie:
        raise ValueError(f"Không thể xóa người dùng ID {user_id} do có các dữ liệu liên quan.")
    finally:
        if conn:
            conn.close()
            

def get_new_users_count_24h():
    """Đếm số lượng người dùng mới đăng ký trong vòng 24 giờ qua."""
    conn = _get_db_connection()
    try:
        query = "SELECT COUNT(id) as count FROM users WHERE created_at >= datetime('now', '-24 hours')"
        result = conn.execute(query).fetchone()
        return result['count'] if result else 0
    except Exception as e:
        current_app.logger.error(f"Error counting new users: {e}")
        return 0
    finally:
        if conn:
            conn.close()