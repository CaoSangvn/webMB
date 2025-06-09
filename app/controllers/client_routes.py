# app/controllers/client_routes.py
from flask import Blueprint, request, jsonify, session, current_app, render_template, redirect, url_for
from app.models import client_model, airport_model, flight_model, menu_item_model, notification_model, settings_model, booking_model, ancillary_service_model
from app.models.menu_item_model import serialize_menu_item 
from werkzeug.security import check_password_hash
import re
import sqlite3
from datetime import datetime, timedelta
from functools import wraps
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Kiểm tra xem 'user_id' có trong session không
        if 'user_id' not in session:
            # Nếu chưa đăng nhập, chuyển hướng đến trang đăng nhập
            # next=request.url sẽ giúp đưa người dùng trở lại trang cũ sau khi đăng nhập thành công
            return redirect(url_for('client_bp.login_page', next=request.url))

        # Nếu đã đăng nhập, cho phép truy cập vào trang
        return f(*args, **kwargs)
    return decorated_function           
client_bp = Blueprint('client_bp', __name__,
                      template_folder='../templates/',
                      url_prefix='/')

# =================================================================
# CÁC ROUTE RENDER TRANG HTML CHO CLIENT
# =================================================================

@client_bp.route('/')
@client_bp.route('/home')
def home_page():
    current_user_name = None
    if 'user_id' in session:
        user = client_model.get_user_by_id(session['user_id'])
        if user:
            current_user_name = user['full_name']
    
    airports_list = []
    try:
        airports_list = airport_model.get_all_airports()
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy danh sách sân bay cho trang chủ: {e}")

    return render_template(
        "client/home.html",
        airports=airports_list,
        current_user_name=current_user_name
    )

@client_bp.route('/dang-nhap')
def login_page():
    if 'user_id' in session:
        user_role = session.get('user_role')
        if user_role == 'admin':
            return redirect(url_for('admin_bp.dashboard'))
        else:
            return redirect(url_for('client_bp.home_page'))
    return render_template("auth/dang_nhap.html")

@client_bp.route('/dang-ky')
def register_page():
    if 'user_id' in session:
        return redirect(url_for('client_bp.home_page'))
    return render_template("auth/dang_ki.html")

@client_bp.route('/logout')
def logout_user():
    session.clear()
    return redirect(url_for('client_bp.home_page'))

@client_bp.route('/chuyen-bay-cua-toi')
@login_required
def my_flights_page():
    current_user_name = None
    if 'user_id' in session:
        user = client_model.get_user_by_id(session['user_id'])
        if user:
            current_user_name = user['full_name']
    return render_template("client/my_flights.html", current_user_name=current_user_name)

@client_bp.route('/e-menu')
def e_menu_page():
    current_user_name = None
    if 'user_id' in session:
        user = client_model.get_user_by_id(session['user_id'])
        if user:
            current_user_name = user['full_name']
    return render_template("client/e_menu.html", current_user_name=current_user_name)

@client_bp.route('/dich-vu-chuyen-bay')
@login_required
def flight_services_page():
    current_user_name = None
    if 'user_id' in session:
        user = client_model.get_user_by_id(session['user_id'])
        if user:
            current_user_name = user['full_name']
    return render_template("client/flight_services.html", current_user_name=current_user_name)

@client_bp.route('/check-in-online')
@login_required
def online_checkin_page():
    current_user_name = None
    if 'user_id' in session:
        user = client_model.get_user_by_id(session['user_id'])
        if user:
            current_user_name = user['full_name']
    return render_template("client/online_checkin.html", current_user_name=current_user_name)

@client_bp.route('/thanh-toan')
@login_required
def payment_page_render():
    if 'user_id' not in session:
        return redirect(url_for('client_bp.login_page', next=request.url))

    user = client_model.get_user_by_id(session['user_id'])
    current_user_name = user['full_name'] if user else "Khách"
    
    booking_details = None
    booking_id_to_pay = session.get('booking_id_to_pay')

    if booking_id_to_pay:
        try:
            details = booking_model.get_booking_details_admin(booking_id_to_pay)
            if details and details['user_id'] == session['user_id']:
                booking_details = details
            else:
                session.pop('booking_id_to_pay', None)
        except Exception as e:
            current_app.logger.error(f"Lỗi khi lấy chi tiết booking để thanh toán: {e}", exc_info=True)
            session.pop('booking_id_to_pay', None)
    
    return render_template('client/payment.html', current_user_name=current_user_name, booking=booking_details)


# =================================================================
# CÁC API ROUTE CHO CLIENT
# =================================================================

@client_bp.route('/api/auth/register', methods=['POST'])
def register_api():
    data = request.get_json()
    if not data or not data.get('full_name') or not data.get('email') or not data.get('password'):
        return jsonify({"success": False, "message": "Họ tên, email và mật khẩu là bắt buộc."}), 400

    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', data['email']):
        return jsonify({"success": False, "message": "Địa chỉ email không hợp lệ."}), 400
    if len(data['password']) < 6:
        return jsonify({"success": False, "message": "Mật khẩu phải có ít nhất 6 ký tự."}), 400
    
    try:
        user_id = client_model.create_user(
            full_name=data['full_name'], 
            email=data['email'], 
            password=data['password'], 
            phone_number=data.get('phone_number')
        )
        return jsonify({"success": True, "message": "Đăng ký thành công!", "user_id": user_id}), 201
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 409
    except Exception as e:
        current_app.logger.error(f"Lỗi API khi đăng ký: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500

@client_bp.route('/api/auth/login', methods=['POST'])
def login_api():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"success": False, "message": "Email và mật khẩu không được để trống."}), 400

    user = client_model.get_user_by_email(data['email'])
    if user:
        if user['status'] != 'active':
            return jsonify({"success": False, "message": f"Tài khoản của bạn đang ở trạng thái '{user['status']}'."}), 403
        if check_password_hash(user['password_hash'], data['password']):
            session.clear()
            session['user_id'] = user['id']
            session['user_role'] = user['role']
            session['user_name'] = user['full_name']
            return jsonify({"success": True, "message": "Đăng nhập thành công!", "user": {"role": user['role']}}), 200

    return jsonify({"success": False, "message": "Email hoặc mật khẩu không chính xác."}), 401

@client_bp.route('/api/auth/logout', methods=['POST'])
def logout_api():
    session.clear()
    return jsonify({"success": True, "message": "Đăng xuất thành công."}), 200

@client_bp.route('/api/auth/status', methods=['GET'])
def status_api():
    if 'user_id' in session:
        user = client_model.get_user_by_id(session['user_id'])
        if user:
            return jsonify({
                "logged_in": True,
                "user": {
                    "id": user['id'],
                    "full_name": user['full_name'],
                    "email": user['email'],
                    "role": user['role']
                }
            }), 200
    session.clear()
    return jsonify({"logged_in": False}), 200

@client_bp.route('/api/airports', methods=['GET'])
def get_airports_api():
    try:
        airports = airport_model.get_all_airports()
        return jsonify({"success": True, "airports": airports}), 200
    except Exception as e:
        current_app.logger.error(f"Lỗi API lấy danh sách sân bay: {e}")
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

@client_bp.route('/api/flights/search', methods=['POST'])
def search_flights_api():
    data = request.get_json()
    if not data or not data.get('origin_iata') or not data.get('destination_iata') or not data.get('departure_date'):
        return jsonify({"success": False, "message": "Thiếu thông tin tìm kiếm."}), 400
    
    try:
        origin_id = airport_model.get_airport_id_by_iata_code(data['origin_iata'])
        destination_id = airport_model.get_airport_id_by_iata_code(data['destination_iata'])
        if not origin_id or not destination_id:
            return jsonify({"success": False, "message": "Mã sân bay không hợp lệ."}), 400

        # <<< LOGIC MỚI: XỬ LÝ CẢ CHUYẾN ĐI VÀ CHUYẾN VỀ >>>
        # Tìm chuyến bay đi
        departure_flights = flight_model.search_flights(
            origin_id,
            destination_id,
            data['departure_date'],
            int(data.get('passengers', 1)),
            data.get('seat_class', 'Phổ thông')
        )
        
        results = {"departure_flights": departure_flights}

        # Nếu có ngày về (tức là tìm khứ hồi), thì tìm thêm chuyến bay về
        if data.get('return_date'):
            return_flights = flight_model.search_flights(
                destination_id,  # Đảo ngược điểm đi/đến
                origin_id,
                data['return_date'],
                int(data.get('passengers', 1)),
                data.get('seat_class', 'Phổ thông')
            )
            results["return_flights"] = return_flights

        return jsonify({"success": True, "flights": results}), 200
        # <<< KẾT THÚC LOGIC MỚI >>>

    except Exception as e:
        current_app.logger.error(f"Lỗi API tìm kiếm chuyến bay: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi tìm kiếm chuyến bay."}), 500

@client_bp.route('/api/bookings', methods=['POST'])
def create_booking_api():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Yêu cầu đăng nhập."}), 401
    
    data = request.get_json()
    if not data: return jsonify({"success": False, "message": "Dữ liệu không hợp lệ."}), 400

    try:
        # << LẤY THÊM DỮ LIỆU CHI PHÍ DỊCH VỤ TỪ CLIENT >>
        ancillary_cost = data.get('ancillary_cost', 0)

        booking_result = booking_model.create_booking(
            user_id=session['user_id'],
            flight_id=data['flight_id'],
            passengers_data=data.get('passengers_data', []),
            seat_class_booked=data['seat_class_booked'],
            num_adults=data['num_adults'],
            num_children=data['num_children'],
            num_infants=data.get('num_infants', 0),
            payment_method=data['payment_method'],
            ancillary_services_cost=ancillary_cost # << TRUYỀN VÀO MODEL
        )
        session['booking_id_to_pay'] = booking_result['booking_id']
        return jsonify({
            "success": True, 
            "message": "Đã tạo đặt chỗ tạm thời! Đang chuyển đến trang thanh toán...",
            "redirect_url": url_for('client_bp.payment_page_render')
        }), 201
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"Lỗi API tạo booking: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi tạo đặt chỗ."}), 500

@client_bp.route('/api/my-bookings', methods=['GET'])
def get_my_bookings_api():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Yêu cầu đăng nhập."}), 401
    try:
        bookings = booking_model.get_bookings_by_user_id(session['user_id'])
        return jsonify({"success": True, "bookings": bookings}), 200
    except Exception as e:
        current_app.logger.error(f"Lỗi API lấy booking của user {session['user_id']}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

@client_bp.route('/api/bookings/lookup', methods=['POST'])
def lookup_booking_api():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ."}), 400

    pnr = data.get('pnr')
    last_name = data.get('lastName')
    first_name = data.get('firstName')

    if not pnr or not last_name or not first_name:
        return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ Mã đặt chỗ, Họ, và Tên."}), 400

    try:
        booking_details = booking_model.get_booking_by_pnr_and_name(pnr, last_name, first_name)
        if booking_details:
            return jsonify({"success": True, "booking": booking_details}), 200
        else:
            return jsonify({"success": False, "message": "Không tìm thấy đặt chỗ phù hợp với thông tin bạn cung cấp."}), 404
    except Exception as e:
        current_app.logger.error(f"Lỗi API tra cứu booking PNR {pnr}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi tra cứu đặt chỗ."}), 500

@client_bp.route('/api/bookings/<int:booking_id>/add-menu-items', methods=['POST'])
def add_menu_items_to_booking_api(booking_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Vui lòng đăng nhập."}), 401

    data = request.get_json()
    if not data or 'menu_items' not in data or not isinstance(data['menu_items'], list):
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ."}), 400
    
    try:
        success, message = booking_model.add_menu_items_to_booking(
            booking_id=booking_id, 
            user_id=session['user_id'], 
            selected_items=data['menu_items']
        )
        if success:
            session['booking_id_to_pay'] = booking_id
            return jsonify({"success": True, "message": message or "Đã thêm dịch vụ. Đang chuyển đến trang thanh toán...", "redirect_url": url_for("client_bp.payment_page_render")}), 200
        else:
            return jsonify({"success": False, "message": message or "Không thể thêm suất ăn."}), 400
    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"Lỗi API khi thêm suất ăn cho booking {booking_id}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500

@client_bp.route('/api/payment/confirm', methods=['POST'])
def confirm_payment_api():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Yêu cầu đăng nhập."}), 401

    data = request.get_json()
    booking_id = data.get('booking_id')
    
    if not booking_id:
        return jsonify({"success": False, "message": "Thiếu mã đặt chỗ."}), 400

    try:
        success = booking_model.process_simulated_payment(booking_id, session['user_id'])
        if success:
            session.pop('booking_id_to_pay', None)
            return jsonify({
                "success": True, 
                "message": "Thanh toán thành công! Đặt chỗ của bạn đã được xác nhận.",
                "redirect_url": url_for('client_bp.my_flights_page')
            }), 200
        else:
            return jsonify({"success": False, "message": "Không thể xử lý thanh toán. Đặt chỗ không hợp lệ."}), 400
    except Exception as e:
        current_app.logger.error(f"Lỗi API xác nhận thanh toán cho booking {booking_id}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500

@client_bp.route('/api/homepage-content', methods=['GET'])
def get_homepage_content_api():
    try:
        notifications = notification_model.get_active_notifications_client()
        notice_title = settings_model.get_setting('homepage_notice_title', 'THÔNG BÁO')
        return jsonify({
            "success": True, 
            "notice_title": notice_title,
            "notice_items": notifications
        }), 200
    except Exception as e:
        current_app.logger.error(f"Lỗi API lấy nội dung trang chủ: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ."}), 500

@client_bp.route('/api/menu-items', methods=['GET'])
def get_e_menu_api():
    try:
        category_filter = request.args.get('category', None)
        items_raw = menu_item_model.get_available_menu_items(category_filter)
        items_serialized = [serialize_menu_item(item) for item in items_raw]
        return jsonify({"success": True, "menu_items": items_serialized}), 200
    except Exception as e:
        current_app.logger.error(f"Client API: Error fetching E-Menu: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi tải E-Menu."}), 500

@client_bp.route('/api/checkin/lookup', methods=['POST'])
def checkin_lookup_api():
    data = request.get_json()
    if not data or not data.get('booking_code') or not data.get('last_name'):
        return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ Mã đặt chỗ và Họ."}), 400
    
    pnr = data['booking_code']
    last_name = data['last_name']

    try:
        booking, message = booking_model.get_booking_for_checkin(pnr, last_name)
        if booking:
            return jsonify({"success": True, "booking": booking}), 200
        else:
            return jsonify({"success": False, "message": message}), 404
    except Exception as e:
        current_app.logger.error(f"Lỗi API tra cứu check-in PNR {pnr}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi tra cứu."}), 500

@client_bp.route('/api/checkin/process', methods=['POST'])
def process_checkin_api():
    data = request.get_json()
    booking_id = data.get('booking_id')
    passenger_ids = data.get('passenger_ids')

    if not booking_id or not passenger_ids or not isinstance(passenger_ids, list) or len(passenger_ids) == 0:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ."}), 400

    try:
        success, message, details = booking_model.process_checkin(booking_id, passenger_ids)
        if success:
            return jsonify({"success": True, "message": message, "details": details}), 200
        else:
            return jsonify({"success": False, "message": message}), 500
    except Exception as e:
        current_app.logger.error(f"Lỗi API xử lý check-in cho booking {booking_id}: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500
@client_bp.route('/api/ancillary-services', methods=['GET'])
def get_ancillary_services_api():
    try:
        services = ancillary_service_model.get_available_services_client()
        return jsonify({"success": True, "services": services}), 200
    except Exception as e:
        current_app.logger.error(f"Client API: Error fetching ancillary services: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ khi tải danh sách dịch vụ."}), 500

@client_bp.route('/api/bookings/add-ancillary-service', methods=['POST'])
def add_ancillary_service_api():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Vui lòng đăng nhập để thực hiện chức năng này."}), 401

    data = request.get_json()
    pnr = data.get('pnr')
    service_id = data.get('service_id')

    if not pnr or not service_id:
        return jsonify({"success": False, "message": "Thiếu thông tin Mã đặt chỗ hoặc Dịch vụ."}), 400

    try:
        # Gọi hàm model đã được cập nhật
        result = booking_model.add_ancillary_service_to_booking(session['user_id'], pnr, service_id)
        
        # Xử lý kết quả trả về từ model
        if result.get('success'):
            session['booking_id_to_pay'] = result.get('booking_id')
            return jsonify({
                "success": True,
                "message": result.get('message', "Đã thêm dịch vụ thành công! Đang chuyển đến trang thanh toán..."),
                "redirect_url": url_for('client_bp.payment_page_render')
            }), 200
        else:
            # Trả về lỗi nếu model xử lý không thành công
            return jsonify({
                "success": False, 
                "message": result.get('message', "Không thể thêm dịch vụ.")
            }), 400

    except ValueError as ve: # Bắt các lỗi validation từ model (dù đã xử lý trong model nhưng để chắc chắn)
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"API Add Service Error: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500
@client_bp.route('/api/bookings/cancel', methods=['POST'])
@login_required
def cancel_booking_api():
    data = request.get_json()
    booking_id = data.get('booking_id')

    if not booking_id:
        return jsonify({"success": False, "message": "Thiếu mã đặt chỗ."}), 400

    try:
        # Gọi hàm model để hủy, truyền vào user_id từ session để bảo mật
        booking_model.cancel_booking_by_user(session['user_id'], booking_id)
        return jsonify({"success": True, "message": "Hủy đặt chỗ thành công!"}), 200
    except ValueError as ve:
        # Bắt các lỗi validation từ model (ví dụ: PNR không hợp lệ, không có quyền hủy)
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"API Cancel Booking Error: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500
def get_new_users_count_24h():
    """Đếm số lượng người dùng đăng ký trong vòng 24 giờ qua."""
    conn = _get_db_connection()
    try:
        query = "SELECT COUNT(id) as count FROM users WHERE created_at >= datetime('now', '-24 hours')"
        result = conn.execute(query).fetchone()
        return result['count'] if result else 0
    finally:
        if conn: conn.close()
def get_new_customers_count_in_range(start_date, end_date):
    conn = _get_db_connection()
    try:
        query = "SELECT COUNT(id) as count FROM users WHERE date(created_at) BETWEEN ? AND ?"
        result = conn.execute(query, (start_date, end_date)).fetchone()
        return result['count'] if result else 0
    finally:
        if conn: conn.close()
@client_bp.route('/dieu-khoan-su-dung')
def terms_of_use_page():
    current_user_name = session.get('user_name')
    return render_template("client/terms_of_use.html", current_user_name=current_user_name)

@client_bp.route('/huong-dan-dat-ve')
def booking_guide_page():
    current_user_name = session.get('user_name')
    return render_template("client/booking_guide.html", current_user_name=current_user_name)
@client_bp.route('/about-us')
def about_us_page():
    # Lấy thông tin người dùng đang đăng nhập để hiển thị trên header
    current_user_name = None
    if 'user_id' in session:
        user = client_model.get_user_by_id(session['user_id'])
        if user:
            current_user_name = user['full_name']
            
    return render_template("client/about_us.html", current_user_name=current_user_name)
@client_bp.route('/chinh-sach-hoan-huy')
def cancellation_policy_page():
    current_user_name = session.get('user_name')
    return render_template("client/cancellation_policy.html", current_user_name=current_user_name)

@client_bp.route('/chinh-sach-hanh-ly')
def baggage_policy_page():
    current_user_name = session.get('user_name')
    return render_template("client/baggage_policy.html", current_user_name=current_user_name)
@client_bp.route('/api/bookings/add-single-menu-item', methods=['POST'])
@login_required
def add_single_menu_item_api():
    data = request.get_json()
    pnr = data.get('pnr')
    menu_item_id = data.get('menu_item_id')

    if not pnr or not menu_item_id:
        return jsonify({"success": False, "message": "Thiếu Mã đặt chỗ hoặc thông tin món ăn."}), 400

    try:
        result = booking_model.add_single_menu_item_to_booking(
            user_id=session['user_id'],
            pnr=pnr,
            menu_item_id=int(menu_item_id)
        )
        
        if result.get('success'):
            session['booking_id_to_pay'] = result.get('booking_id')
            return jsonify({
                "success": True,
                "message": result.get('message'),
                "redirect_url": url_for('client_bp.payment_page_render')
            }), 200
        else:
            return jsonify({"success": False, "message": result.get('message')}), 400

    except ValueError as ve:
        return jsonify({"success": False, "message": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"API Add Single Menu Item Error: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Lỗi máy chủ không xác định."}), 500