# app/controllers/admin_routes.py
from flask import Blueprint, render_template, session, redirect, url_for, current_app, request, jsonify
from functools import wraps
import sqlite3
from datetime import datetime, timedelta
import os
from werkzeug.utils import secure_filename

# Import tất cả các model cần thiết ở đầu tệp
from app.models import (
    flight_model,
    airport_model,
    client_model,
    booking_model,
    menu_item_model,
    notification_model,
    settings_model,
    ancillary_service_model,
    stats_model
)
from app.models.flight_model import combine_datetime_str
from app.models.menu_item_model import serialize_menu_item

admin_bp = Blueprint('admin_bp', __name__,
                     template_folder='../templates/admin',
                     url_prefix='/admin')

# --- CÁC HÀM HELPER VÀ DECORATOR ---

def allowed_file(filename):
    """Kiểm tra xem đuôi file có được phép không."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('user_role') != 'admin':
            if request.path.startswith('/admin/api/'):
                 return jsonify(success=False, message="Yêu cầu đăng nhập với quyền quản trị."), 401
            return redirect(url_for('client_bp.login_page', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

# --- CÁC ROUTE RENDER TRANG HTML CHO ADMIN ---

@admin_bp.route('/')
@admin_bp.route('/dashboard')
@admin_required
def dashboard():
    return render_template('dashboard.html')

@admin_bp.route('/flights')
@admin_required
def flights():
    return render_template('flights.html')

@admin_bp.route('/bookings')
@admin_required
def quan_ly_dat_cho():
    return render_template('quan_ly_dat_cho.html')

@admin_bp.route('/users')
@admin_required
def quan_ly_nguoi_dung():
    return render_template('quan_ly_nguoi_dung.html')

@admin_bp.route('/homepage-notifications')
@admin_required
def quan_ly_thong_bao_trang_chu():
    return render_template('quan_ly_thong_bao_trang_chu.html')

@admin_bp.route('/emenu-management')
@admin_required
def quan_ly_e_menu():
    return render_template('quan_ly_e_menu.html')
    
@admin_bp.route('/services')
@admin_required
def quan_ly_dich_vu():
    return render_template('quan_ly_dich_vu.html')

@admin_bp.route('/reports-statistics')
@admin_required
def bao_cao_thong_ke():
    return render_template('admin/bao_cao_thong_ke.html') # Đảm bảo tên file khớp
    
# --- ================================== ---
# ---           CÁC API CHO ADMIN        ---
# --- ================================== ---

# --- API Quản lý chuyến bay ---
@admin_bp.route('/api/flights', methods=['GET'])
@admin_required
def api_admin_get_all_flights():
    try:
        flights_data = flight_model.get_all_flights_admin()
        return jsonify({"success": True, "flights": flights_data}), 200
    except Exception as e:
        current_app.logger.error(f"API Error get_all_flights: {e}", exc_info=True)
        return jsonify({"success": False, "message": f"Lỗi máy chủ: {e}"}), 500

@admin_bp.route('/api/flights/<int:flight_id>', methods=['GET'])
@admin_required
def api_admin_get_flight(flight_id):
    try:
        flight = flight_model.get_flight_by_id_admin(flight_id)
        if flight:
            return jsonify({"success": True, "flight": flight}), 200
        return jsonify({"success": False, "message": "Không tìm thấy chuyến bay."}), 404
    except Exception as e:
        current_app.logger.error(f"API Error get_flight {flight_id}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ"}), 500

@admin_bp.route('/api/flights', methods=['POST'])
@admin_required
def api_admin_create_flight():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ."}), 400

    try:
        departure_airport_id = airport_model.get_airport_id_by_iata_code(data.get('departureAirport'))
        arrival_airport_id = airport_model.get_airport_id_by_iata_code(data.get('arrivalAirport'))

        if not departure_airport_id or not arrival_airport_id:
            return jsonify({"success": False, "message": "Mã sân bay đi hoặc đến không hợp lệ."}), 400

        mapped_data = {
            'departure_airport_id': departure_airport_id,
            'arrival_airport_id': arrival_airport_id,
            'departureDate': data.get('departureDate'),
            'departureTime': data.get('departureTime'),
            'arrivalDate': data.get('arrivalDate'),
            'arrivalTime': data.get('arrivalTime'),
            'basePrice': data.get('basePrice'),
            'total_seats': data.get('totalSeats'),
        }

        flight_id = flight_model.create_flight(mapped_data)
        new_flight = flight_model.get_flight_by_id_admin(flight_id)
        return jsonify({"success": True, "message": "Tạo chuyến bay thành công!", "flight": new_flight}), 201
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"API Error create_flight: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500


@admin_bp.route('/api/flights/<int:flight_id>', methods=['PUT'])
@admin_required
def api_admin_update_flight(flight_id):
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ."}), 400
        
    try:
        departure_airport_id = airport_model.get_airport_id_by_iata_code(data.get('departureAirport'))
        arrival_airport_id = airport_model.get_airport_id_by_iata_code(data.get('arrivalAirport'))

        if not departure_airport_id or not arrival_airport_id:
            return jsonify({"success": False, "message": "Mã sân bay đi hoặc đến không hợp lệ."}), 400

        mapped_data = {
            'departure_airport_id': departure_airport_id,
            'arrival_airport_id': arrival_airport_id,
            'departureDate': data.get('departureDate'),
            'departureTime': data.get('departureTime'),
            'arrivalDate': data.get('arrivalDate'),
            'arrivalTime': data.get('arrivalTime'),
            'economy_price': data.get('basePrice'),
            'total_seats': data.get('totalSeats'),
            'status': data.get('flightStatus'),
        }

        success = flight_model.update_flight(flight_id, mapped_data)
        if success:
            updated_flight = flight_model.get_flight_by_id_admin(flight_id)
            return jsonify({"success": True, "message": "Cập nhật thành công.", "flight": updated_flight}), 200
        return jsonify({"success": False, "message": "Không thể cập nhật hoặc không có gì thay đổi."}), 400
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"API Error update_flight {flight_id}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500

@admin_bp.route('/api/flights/<int:flight_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_flight(flight_id):
    try:
        success = flight_model.delete_flight(flight_id)
        if success:
            return jsonify({"success": True, "message": "Xóa thành công."}), 200
        return jsonify({"success": False, "message": "Không thể xóa hoặc chuyến bay không tồn tại."}), 404
    except Exception as e:
        current_app.logger.error(f"API Error delete_flight {flight_id}: {e}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500

# Các API khác cho User, Booking, Menu, Service... (giữ nguyên như cũ)
# ...
# --- API Quản lý người dùng ---
@admin_bp.route('/api/users', methods=['GET'])
@admin_required
def api_admin_get_all_users():
    try:
        search_term = request.args.get('search')
        status_filter = request.args.get('status')
        users = client_model.get_all_users_admin(search_term=search_term, status_filter=status_filter)
        return jsonify({"success": True, "users": users}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi máy chủ: {e}"}), 500

@admin_bp.route('/api/users/<int:user_id>', methods=['GET'])
@admin_required
def api_admin_get_user(user_id):
    user = client_model.get_user_by_id(user_id)
    if user:
        user_dict = dict(user)
        user_dict.pop('password_hash', None)
        return jsonify({"success": True, "user": user_dict}), 200
    return jsonify({"success": False, "message": "Không tìm thấy người dùng."}), 404

@admin_bp.route('/api/users', methods=['POST'])
@admin_required
def api_admin_create_user():
    data = request.get_json()
    try:
        user_id = client_model.create_user_by_admin(data)
        new_user = client_model.get_user_by_id(user_id)
        user_dict = dict(new_user)
        user_dict.pop('password_hash', None)
        return jsonify({"success": True, "message": "Tạo người dùng thành công!", "user": user_dict}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@admin_bp.route('/api/users/<int:user_id>', methods=['PUT'])
@admin_required
def api_admin_update_user(user_id):
    data = request.get_json()
    try:
        success = client_model.update_user_by_admin(user_id, data)
        if success:
            updated_user = client_model.get_user_by_id(user_id)
            user_dict = dict(updated_user)
            user_dict.pop('password_hash', None)
            return jsonify({"success": True, "message": "Cập nhật thành công.", "user": user_dict}), 200
        return jsonify({"success": False, "message": "Không thể cập nhật."}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route('/api/users/<int:user_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_user(user_id):
    if 'user_id' in session and int(user_id) == session['user_id']:
        return jsonify({"success": False, "message": "Không thể tự xóa tài khoản đang đăng nhập."}), 403
    try:
        success = client_model.delete_user_by_admin(user_id)
        if success:
            return jsonify({"success": True, "message": "Xóa người dùng thành công."}), 200
        return jsonify({"success": False, "message": "Không thể xóa người dùng."}), 404
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --- API Quản lý Đặt chỗ ---
@admin_bp.route('/api/bookings', methods=['GET'])
@admin_required
def api_admin_get_all_bookings():
    try:
        search_term = request.args.get('search')
        status_filter = request.args.get('status')
        flight_date_filter = request.args.get('flightDate')
        bookings = booking_model.get_all_bookings_admin(
            search_term=search_term,
            status_filter=status_filter,
            flight_date_filter=flight_date_filter
        )
        return jsonify({"success": True, "bookings": bookings}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi máy chủ: {e}"}), 500

@admin_bp.route('/api/bookings/<int:booking_id>', methods=['GET'])
@admin_required
def api_admin_get_booking_details(booking_id):
    details = booking_model.get_booking_details_admin(booking_id)
    if details:
        return jsonify({"success": True, "booking": details}), 200
    return jsonify({"success": False, "message": "Không tìm thấy đặt chỗ."}), 404

@admin_bp.route('/api/bookings/<int:booking_id>/status', methods=['PUT'])
@admin_required
def api_admin_update_booking_status(booking_id):
    data = request.get_json()
    if not data or 'newStatus' not in data:
        return jsonify({"success": False, "message": "Thiếu trạng thái mới."}), 400
    try:
        success = booking_model.update_booking_status_admin(booking_id, data['newStatus'], data.get('adminNotes'))
        if success:
            updated_booking = booking_model.get_booking_details_admin(booking_id)
            return jsonify({"success": True, "message": "Cập nhật trạng thái thành công.", "booking": updated_booking}), 200
        return jsonify({"success": False, "message": "Không thể cập nhật."}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route('/api/bookings/<int:booking_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_booking(booking_id):
    try:
        success = booking_model.delete_booking_by_admin(booking_id)
        if success:
            return jsonify({"success": True, "message": "Xóa đặt chỗ thành công."}), 200
        else:
            return jsonify({"success": False, "message": "Không tìm thấy đặt chỗ để xóa."}), 404
    except Exception as e:
        current_app.logger.error(f"API Error deleting booking {booking_id}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi xóa đặt chỗ."}), 500
    

# --- API Quản lý E-Menu ---
@admin_bp.route('/api/menu-items', methods=['GET'])
@admin_required
def api_admin_get_all_menu_items():
    try:
        search_term = request.args.get('search')
        category_filter = request.args.get('category')
        items_raw = menu_item_model.get_all_menu_items_admin(search_term, category_filter)
        items = [serialize_menu_item(item) for item in items_raw]
        return jsonify({"success": True, "menu_items": items}), 200
    except Exception as e:
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

@admin_bp.route('/api/menu-items/<int:item_id>', methods=['GET'])
@admin_required
def api_admin_get_menu_item(item_id):
    item = menu_item_model.get_menu_item_by_id(item_id)
    if item:
        return jsonify({"success": True, "menu_item": item}), 200
    return jsonify({"success": False, "message": "Không tìm thấy món."}), 404

@admin_bp.route('/api/menu-items', methods=['POST'])
@admin_required
def api_admin_create_menu_item():
    if 'menuItemName' not in request.form or 'menuItemCategory' not in request.form or 'menuItemPriceVND' not in request.form or 'menuItemPriceUSD' not in request.form:
        return jsonify({"success": False, "message": "Thiếu các trường thông tin bắt buộc (Tên, Danh mục, Giá)."}), 400

    item_data = {
        'name': request.form.get('menuItemName'),
        'description': request.form.get('menuItemDescription'),
        'category': request.form.get('menuItemCategory'),
        'price_vnd': request.form.get('menuItemPriceVND'),
        'price_usd': request.form.get('menuItemPriceUSD'),
        'is_available': request.form.get('is_available', 1)
    }

    image_url = None
    if 'menuItemImageFile' in request.files:
        file = request.files['menuItemImageFile']
        if file and file.filename != '' and allowed_file(file.filename):
            try:
                unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{secure_filename(file.filename)}"
                upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(upload_path)
                image_url = os.path.join('uploads/menu_images', unique_filename).replace("\\", "/")
            except Exception as e:
                current_app.logger.error(f"Lỗi khi lưu file ảnh: {e}")
                return jsonify({"success": False, "message": "Lỗi khi xử lý file ảnh."}), 500
    
    if image_url:
        item_data['image_url'] = image_url

    try:
        item_id = menu_item_model.create_menu_item(item_data)
        new_item = menu_item_model.get_menu_item_by_id(item_id)
        return jsonify({"success": True, "message": "Thêm món thành công!", "menu_item": serialize_menu_item(new_item)}), 201
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"Lỗi API khi tạo menu item: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route('/api/menu-items/<int:item_id>', methods=['PUT'])
@admin_required
def api_admin_update_menu_item(item_id):
    item_to_update = menu_item_model.get_menu_item_by_id(item_id)
    if not item_to_update:
        return jsonify({"success": False, "message": "Không tìm thấy món để cập nhật."}), 404
        
    mapped_data = {
        'name': request.form.get('menuItemName'),
        'description': request.form.get('menuItemDescription'),
        'category': request.form.get('menuItemCategory'),
        'price_vnd': request.form.get('menuItemPriceVND'),
        'price_usd': request.form.get('menuItemPriceUSD'),
        'is_available': request.form.get('is_available')
    }
    
    if 'menuItemImageFile' in request.files:
        file = request.files['menuItemImageFile']
        if file and file.filename != '' and allowed_file(file.filename):
            try:
                unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{secure_filename(file.filename)}"
                upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(upload_path)
                mapped_data['image_url'] = os.path.join('uploads/menu_images', unique_filename).replace("\\", "/")
            except Exception as e:
                current_app.logger.error(f"Lỗi khi lưu file ảnh (update): {e}")
                return jsonify({"success": False, "message": "Lỗi khi xử lý file ảnh mới."}), 500

    try:
        success = menu_item_model.update_menu_item(item_id, mapped_data)
        if success:
            updated_item = menu_item_model.get_menu_item_by_id(item_id)
            return jsonify({"success": True, "message": "Cập nhật thành công.", "menu_item": serialize_menu_item(updated_item)}), 200
        return jsonify({"success": False, "message": "Không thể cập nhật hoặc không có gì thay đổi."}), 400
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"Lỗi API khi cập nhật menu item: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route('/api/menu-items/<int:item_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_menu_item(item_id):
    try:
        success = menu_item_model.delete_menu_item(item_id)
        if success:
            return jsonify({"success": True, "message": "Xóa món thành công."}), 200
        return jsonify({"success": False, "message": "Không tìm thấy món để xóa."}), 404
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --- API Quản lý Thông báo & Cài đặt ---
@admin_bp.route('/api/notifications', methods=['GET'])
@admin_required
def api_admin_get_notifications():
    notifications = notification_model.get_all_notifications_admin()
    return jsonify({"success": True, "notifications": notifications}), 200

@admin_bp.route('/api/notifications', methods=['POST'])
@admin_required
def api_admin_create_notification():
    data = request.get_json()
    if not data or not data.get('content'):
        return jsonify({"success": False, "message": "Nội dung là bắt buộc."}), 400
    try:
        item_id = notification_model.create_notification(data)
        new_item = notification_model.get_notification_by_id(item_id)
        return jsonify({"success": True, "message": "Thêm thông báo thành công!", "notification": new_item}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route('/api/notifications/<int:item_id>', methods=['PUT'])
@admin_required
def api_admin_update_notification(item_id):
    data = request.get_json()
    try:
        success = notification_model.update_notification(item_id, data)
        if success:
            updated_item = notification_model.get_notification_by_id(item_id)
            return jsonify({"success": True, "message": "Cập nhật thành công.", "notification": updated_item}), 200
        return jsonify({"success": False, "message": "Không thể cập nhật."}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route('/api/notifications/<int:item_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_notification(item_id):
    try:
        success = notification_model.delete_notification(item_id)
        if success:
            return jsonify({"success": True, "message": "Xóa thành công."}), 200
        return jsonify({"success": False, "message": "Không tìm thấy để xóa."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route('/api/settings/homepage-notice', methods=['POST'])
@admin_required
def api_admin_update_homepage_notice_settings():
    data = request.get_json()
    if not data or 'title' not in data:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ."}), 400
    try:
        settings_model.update_setting('homepage_notice_title', data['title'])
        return jsonify({"success": True, "message": "Cài đặt đã được lưu."}), 200
    except Exception as e:
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

# --- API Quản lý Dịch vụ Chuyến bay ---
@admin_bp.route('/api/services', methods=['GET'])
@admin_required
def api_admin_get_all_services():
    try:
        services = ancillary_service_model.get_all_ancillary_services()
        return jsonify({"success": True, "services": services}), 200
    except Exception as e:
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

@admin_bp.route('/api/services/<int:service_id>', methods=['GET'])
@admin_required
def api_admin_get_service(service_id):
    try:
        service = ancillary_service_model.get_ancillary_service_by_id(service_id)
        if service:
            return jsonify({"success": True, "service": service}), 200
        return jsonify({"success": False, "message": "Không tìm thấy dịch vụ."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

@admin_bp.route('/api/services', methods=['POST'])
@admin_required
def api_admin_create_service():
    data = request.get_json()
    try:
        service_id = ancillary_service_model.create_ancillary_service(data)
        new_service = ancillary_service_model.get_ancillary_service_by_id(service_id)
        return jsonify({"success": True, "message": "Tạo dịch vụ thành công!", "service": new_service}), 201
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

@admin_bp.route('/api/services/<int:service_id>', methods=['PUT'])
@admin_required
def api_admin_update_service(service_id):
    data = request.get_json()
    try:
        success = ancillary_service_model.update_ancillary_service(service_id, data)
        if success:
            updated_service = ancillary_service_model.get_ancillary_service_by_id(service_id)
            return jsonify({"success": True, "message": "Cập nhật dịch vụ thành công.", "service": updated_service}), 200
        return jsonify({"success": False, "message": "Không thể cập nhật hoặc không có thay đổi."}), 404
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

@admin_bp.route('/api/services/<int:service_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_service(service_id):
    try:
        success = ancillary_service_model.delete_ancillary_service(service_id)
        if success:
            return jsonify({"success": True, "message": "Xóa dịch vụ thành công."}), 200
        return jsonify({"success": False, "message": "Không tìm thấy dịch vụ để xóa."}), 404
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500
    
@admin_bp.route('/api/dashboard/stats', methods=['GET'])
@admin_required
def api_get_dashboard_stats():
    try:
        stats = {
            'upcoming_flights': flight_model.get_upcoming_flights_count(),
            'new_bookings_24h': booking_model.get_new_bookings_count_24h(),
            'new_users_24h': client_model.get_new_users_count_24h(),
            'monthly_revenue': booking_model.get_monthly_revenue()
        }
        return jsonify({"success": True, "stats": stats}), 200
    except Exception as e:
        current_app.logger.error(f"Admin API: Error fetching dashboard stats: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi lấy dữ liệu thống kê."}), 500



# --- STATISTICS API FOR ADMIN ---
@admin_bp.route('/api/stats', methods=['GET'])
@admin_required
def api_admin_get_stats():
    date_range_key = request.args.get('range', 'last30days') # Mặc định 30 ngày qua
    end_date = datetime.now()
    if date_range_key == 'today':
        start_date = end_date
    elif date_range_key == 'last7days':
        start_date = end_date - timedelta(days=6)
    elif date_range_key == 'this_month':
        start_date = end_date.replace(day=1)
    else: # Mặc định là last30days
        start_date = end_date - timedelta(days=29)

    start_date_str = start_date.strftime('%Y-%m-%d')
    end_date_str = end_date.strftime('%Y-%m-%d')
    
    try:
        overview_stats = stats_model.get_overview_stats(start_date_str, end_date_str)
        booking_status_data = stats_model.get_booking_status_chart_data(start_date_str, end_date_str)
        top_routes_data = stats_model.get_top_routes_data(start_date_str, end_date_str)

        return jsonify({
            "success": True,
            "overview": overview_stats,
            "bookingStatusChart": booking_status_data,
            "topRoutes": top_routes_data
        }), 200
    except Exception as e:
        current_app.logger.error(f"Admin API: Error fetching statistics: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi lấy dữ liệu thống kê."}), 500