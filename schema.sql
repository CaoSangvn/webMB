-- Xóa các bảng nếu đã tồn tại để tránh lỗi khi khởi tạo lại
DROP TABLE IF EXISTS booking_menu_items;
DROP TABLE IF EXISTS booking_ancillary_services;
DROP TABLE IF EXISTS passengers;
DROP TABLE IF EXISTS bookings; -- Sẽ được tạo lại với cấu trúc mới
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS airports;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS ancillary_services;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Bảng Users (Giữ nguyên)
-- Trong schema.sql
DROP TABLE IF EXISTS users; -- Xóa bảng cũ nếu có trước khi tạo lại
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client', 'admin')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'pending', 'locked')), -- Trạng thái tài khoản
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);

-- Bảng Sessions (Giữ nguyên)
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Bảng Airports (Giữ nguyên)
CREATE TABLE airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    iata_code TEXT UNIQUE NOT NULL
);

-- Bảng Flights (Giữ nguyên như lần cập nhật trước)
-- Trong schema.sql

-- ... (các lệnh DROP TABLE và CREATE TABLE khác giữ nguyên) ...

DROP TABLE IF EXISTS flights; -- Đảm bảo xóa bảng cũ trước khi tạo lại với schema mới
CREATE TABLE flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_number TEXT NOT NULL,
    departure_airport_id INTEGER NOT NULL,
    arrival_airport_id INTEGER NOT NULL,
    departure_time DATETIME NOT NULL,
    arrival_time DATETIME NOT NULL,
    economy_price REAL NOT NULL DEFAULT 0,
    business_price REAL NOT NULL DEFAULT 0,
    first_class_price REAL NOT NULL DEFAULT 0,
    total_seats INTEGER NOT NULL,
    available_seats INTEGER NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'on_time', 'delayed', 'cancelled', 'departed', 'landed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (departure_airport_id) REFERENCES airports (id) ON DELETE RESTRICT,
    FOREIGN KEY (arrival_airport_id) REFERENCES airports (id) ON DELETE RESTRICT
);

-- Bảng Promotions (Giữ nguyên)
CREATE TABLE promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promo_code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_percentage REAL,
    discount_amount REAL,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    min_spend REAL DEFAULT 0,
    max_discount REAL,
    usage_limit INTEGER,
    times_used INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Bookings: Lưu thông tin các đặt chỗ (ĐÃ CẬP NHẬT - BỎ taxes_fees)
CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    flight_id INTEGER NOT NULL,
    booking_code TEXT UNIQUE NOT NULL,
    booking_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    num_adults INTEGER NOT NULL DEFAULT 1,
    num_children INTEGER DEFAULT 0,
    num_infants INTEGER DEFAULT 0,
    seat_class_booked TEXT NOT NULL,
    base_fare REAL NOT NULL, -- Giá vé gốc trước dịch vụ, giảm giá
    ancillary_services_total REAL DEFAULT 0, -- Tổng tiền các dịch vụ cộng thêm
    promotion_id INTEGER,
    discount_applied REAL DEFAULT 0, -- Số tiền đã được giảm
    total_amount REAL NOT NULL, -- Tổng tiền cuối cùng phải trả (base_fare + ancillary_services_total - discount_applied)
    payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment', 'confirmed', 'cancelled_by_user', 'cancelled_by_airline', 'changed', 'completed','payment_received','no_show')),
    checkin_status TEXT DEFAULT 'not_checked_in' CHECK(checkin_status IN ('not_checked_in', 'checked_in', 'boarding_pass_issued')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (flight_id) REFERENCES flights (id) ON DELETE CASCADE,
    FOREIGN KEY (promotion_id) REFERENCES promotions (id) ON DELETE SET NULL
);

-- Bảng Passengers (Giữ nguyên)
CREATE TABLE passengers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    title TEXT,
    first_name TEXT,
    last_name TEXT,
    date_of_birth DATE,
    gender TEXT CHECK(gender IN ('male', 'female', 'other')),
    passenger_type TEXT NOT NULL DEFAULT 'adult' CHECK(passenger_type IN ('adult', 'child', 'infant')),
    passport_number TEXT,
    nationality TEXT,
    seat_assigned TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
);

-- Bảng Notifications (Giữ nguyên)
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    link_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    start_date DATETIME,
    end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lưu các cài đặt chung của trang web
CREATE TABLE settings (
    setting_key TEXT PRIMARY KEY NOT NULL,
    setting_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng MenuItems (Giữ nguyên)
CREATE TABLE menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK(category IN ('combo', 'do_an_nong', 'do_uong', 'mon_an_vat')),
    price_vnd REAL NOT NULL,
    price_usd REAL,
    image_url TEXT,
    is_available INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng AncillaryServices (Giữ nguyên)
CREATE TABLE ancillary_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK(category IN ('baggage', 'seat_preference', 'meal_preorder', 'insurance', 'priority_services', 'airport_transfer', 'in_flight_entertainment')),
    price_vnd REAL NOT NULL DEFAULT 0,
    price_usd REAL,
    conditions TEXT,
    is_available INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Booking_AncillaryServices (Giữ nguyên)
CREATE TABLE booking_ancillary_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    ancillary_service_id INTEGER NOT NULL,
    passenger_id INTEGER,
    quantity INTEGER DEFAULT 1,
    price_at_booking REAL NOT NULL,
    notes TEXT,
    FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    FOREIGN KEY (ancillary_service_id) REFERENCES ancillary_services (id) ON DELETE RESTRICT,
    FOREIGN KEY (passenger_id) REFERENCES passengers (id) ON DELETE CASCADE
);

-- Bảng Booking_MenuItems (Giữ nguyên)
CREATE TABLE booking_menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    passenger_id INTEGER,
    menu_item_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    price_at_booking REAL NOT NULL,
    notes TEXT,
    FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    FOREIGN KEY (passenger_id) REFERENCES passengers (id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE RESTRICT
);

-- Tạo Indexes (Giữ nguyên)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_airports_iata_code ON airports (iata_code);
CREATE INDEX IF NOT EXISTS idx_flights_departure_airport_id ON flights (departure_airport_id);
CREATE INDEX IF NOT EXISTS idx_flights_arrival_airport_id ON flights (arrival_airport_id);
CREATE INDEX IF NOT EXISTS idx_flights_departure_time ON flights (departure_time);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_flight_id ON bookings (flight_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_code ON bookings (booking_code);
CREATE INDEX IF NOT EXISTS idx_passengers_booking_id ON passengers (booking_id);
CREATE INDEX IF NOT EXISTS idx_passengers_last_name ON passengers (last_name);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

PRAGMA foreign_keys = ON;

INSERT INTO users (full_name, email, password_hash, role, status, phone_number) VALUES 
('Admin Master', 'admin@gmail.com', 'scrypt:32768:8:1$DL1seCgmwTgBtSDU$7c021d76e34edf6145efb1eaf98550a96863cad6d7a8bbb965664097a240d21f5b0715c290d1cc905aaccffde51225182dcccb892388a4eeae1ef17024127b23', 'admin', 'active', NULL);

INSERT INTO airports (name, city, country, iata_code) VALUES
('Sân bay Quốc tế Tân Sơn Nhất', 'TP. Hồ Chí Minh', 'Việt Nam', 'SGN'),
('Sân bay Quốc tế Nội Bài', 'Hà Nội', 'Việt Nam', 'HAN'),
('Sân bay Quốc tế Đà Nẵng', 'Đà Nẵng', 'Việt Nam', 'DAD'),
('Sân bay Quốc tế Phú Quốc', 'Phú Quốc', 'Việt Nam', 'PQC'),
('Sân bay Quốc tế Cam Ranh', 'Nha Trang', 'Việt Nam', 'CXR'),
('Sân bay Quốc tế Cát Bi', 'Hải Phòng', 'Việt Nam', 'HPH'),
('Sân bay Liên Khương', 'Đà Lạt', 'Việt Nam', 'DLI'),
('Sân bay Phú Bài', 'Huế', 'Việt Nam', 'HUI'),
('Sân bay Vinh', 'Vinh', 'Việt Nam', 'VII'),
('Sân bay Côn Đảo', 'Côn Đảo', 'Việt Nam', 'VCS'),
('Sân bay Pleiku', 'Pleiku', 'Việt Nam', 'PXU'),
('Sân bay Phù Cát', 'Quy Nhơn', 'Việt Nam', 'UIH'),
('Sân bay Cần Thơ', 'Cần Thơ', 'Việt Nam', 'VCA');

-- Xóa dữ liệu cũ trong bảng flights trước khi chèn mới (tùy chọn nhưng khuyến khích)
DELETE FROM flights;

-- Chèn dữ liệu chuyến bay mẫu với ngày giờ cụ thể (Mốc thời gian: 09/06/2025)
INSERT INTO flights (flight_number, departure_airport_id, arrival_airport_id, departure_time, arrival_time, economy_price, business_price, first_class_price, total_seats, available_seats, status) VALUES

-- ======= CHUYẾN BAY ĐỂ TEST CHECK-IN (KHỞI HÀNH TRONG 24H) =======
('SA99', (SELECT id FROM airports WHERE iata_code = 'SGN'), (SELECT id FROM airports WHERE iata_code = 'HAN'), '2025-06-10 10:00:00', '2025-06-10 12:05:00', 1800000, 3500000, 6000000, 150, 140, 'scheduled'),

-- ======= CÁC CHUYẾN BAY TRONG TƯƠNG LAI =======
('SA1', (SELECT id FROM airports WHERE iata_code = 'SGN'), (SELECT id FROM airports WHERE iata_code = 'HAN'), '2025-06-12 08:30:00', '2025-06-12 10:35:00', 1500000, 3000000, 5000000, 150, 145, 'scheduled'),
('SA2', (SELECT id FROM airports WHERE iata_code = 'SGN'), (SELECT id FROM airports WHERE iata_code = 'HAN'), '2025-06-12 15:30:00', '2025-06-12 17:35:00', 1600000, 3200000, 5200000, 160, 160, 'scheduled'),
('SA3', (SELECT id FROM airports WHERE iata_code = 'HAN'), (SELECT id FROM airports WHERE iata_code = 'DAD'), '2025-06-13 09:00:00', '2025-06-13 10:20:00', 1100000, 2200000, 3800000, 180, 170, 'scheduled'),
('SA4', (SELECT id FROM airports WHERE iata_code = 'SGN'), (SELECT id FROM airports WHERE iata_code = 'PQC'), '2025-06-14 13:00:00', '2025-06-14 14:00:00', 950000, 1900000, 3800000, 70, 65, 'scheduled'),
('SA5', (SELECT id FROM airports WHERE iata_code = 'PQC'), (SELECT id FROM airports WHERE iata_code = 'SGN'), '2025-06-14 16:00:00', '2025-06-14 17:00:00', 980000, 1950000, 7000000, 150, 150, 'scheduled'),
('SA6', (SELECT id FROM airports WHERE iata_code = 'HAN'), (SELECT id FROM airports WHERE iata_code = 'CXR'), '2025-06-15 07:00:00', '2025-06-15 08:50:00', 2200000, 4500000, 3800000, 250, 240, 'scheduled'),
('SA7', (SELECT id FROM airports WHERE iata_code = 'DAD'), (SELECT id FROM airports WHERE iata_code = 'SGN'), '2025-06-13 17:00:00', '2025-06-13 18:20:00', 1250000, 2550000, 4050000, 150, 150, 'scheduled'),
('SA8', (SELECT id FROM airports WHERE iata_code = 'CXR'), (SELECT id FROM airports WHERE iata_code = 'HAN'), '2025-06-16 11:00:00', '2025-06-16 12:50:00', 2100000, 4300000, 6800000, 180, 180, 'scheduled'),
('SA9', (SELECT id FROM airports WHERE iata_code = 'HPH'), (SELECT id FROM airports WHERE iata_code = 'HUI'), '2025-06-12 14:00:00', '2025-06-12 15:10:00', 800000, 1000000, 2000000, 70, 70, 'scheduled'),
('SA10', (SELECT id FROM airports WHERE iata_code = 'DLI'), (SELECT id FROM airports WHERE iata_code = 'SGN'), '2025-06-14 18:00:00', '2025-06-14 18:50:00', 1300000, 2600000, 3000000, 150, 140, 'scheduled'),
('SA11', (SELECT id FROM airports WHERE iata_code = 'HAN'), (SELECT id FROM airports WHERE iata_code = 'SGN'), '2025-06-11 06:00:00', '2025-06-11 08:05:00', 1450000, 2900000, 4800000, 160, 150, 'scheduled'),
('SA12', (SELECT id FROM airports WHERE iata_code = 'HAN'), (SELECT id FROM airports WHERE iata_code = 'SGN'), '2025-06-11 19:00:00', '2025-06-11 21:05:00', 1480000, 2950000, 4900000, 160, 160, 'scheduled'),
('SA13', (SELECT id FROM airports WHERE iata_code = 'HAN'), (SELECT id FROM airports WHERE iata_code = 'VII'), '2025-06-14 16:30:00', '2025-06-14 17:40:00', 890000, 1750000, 2000000, 120, 115, 'scheduled'),
('SA14', (SELECT id FROM airports WHERE iata_code = 'SGN'), (SELECT id FROM airports WHERE iata_code = 'CXR'), '2025-06-12 13:00:00', '2025-06-12 14:20:00', 920000, 1900000, 3000000, 150, 150, 'scheduled'),
('SA15', (SELECT id FROM airports WHERE iata_code = 'HAN'), (SELECT id FROM airports WHERE iata_code = 'PQC'), '2025-06-15 06:00:00', '2025-06-15 08:20:00', 1750000, 3400000, 5200000, 180, 175, 'scheduled'),

-- ======= CHUYẾN BAY TRONG QUÁ KHỨ (ĐỂ TEST LỊCH SỬ) =======
('SA20', (SELECT id FROM airports WHERE iata_code = 'SGN'), (SELECT id FROM airports WHERE iata_code = 'DAD'), '2025-06-01 10:00:00', '2025-06-01 11:20:00', 1200000, 2500000, 4000000, 150, 0, 'landed');

-- Dữ liệu mẫu cho bảng 'menu_items'

-- Xóa dữ liệu cũ trong bảng nếu bạn muốn chèn lại từ đầu (tùy chọn)
-- DELETE FROM menu_items;

INSERT INTO menu_items (name, description, category, price_vnd, image_url, is_available) VALUES
('Combo Cơm Gà Xối Mỡ', 'Cơm gà xối mỡ giòn rụm, kèm nước ngọt và canh.', 'combo', 120000, 'static/uploads/menu_images/sample_combo.jpg', 1),
('Mì Ý Sốt Bò Bằm', 'Mì Ý chuẩn vị, sốt bò bằm đậm đà từ thịt bò Úc.', 'do_an_nong', 150000, 'static/uploads/menu_images/sample_mi_y.jpg', 1),
('Phở Bò Đặc Biệt', 'Phở bò truyền thống với nước dùng thanh ngọt, đầy đủ thịt.', 'do_an_nong', 90000, NULL, 1),
('Trà Đào Cam Sả', 'Trà đào thơm lừng kết hợp vị cam sả tươi mát, giải nhiệt.', 'do_uong', 50000, NULL, 1),
('Snack Khoai Tây Vị Tảo Biển', 'Gói khoai tây chiên giòn tan, đậm vị tảo biển.', 'mon_an_vat', 25000, 0);


INSERT INTO notifications (title, content, is_active, display_order) VALUES
('Lịch bay mùa hè', '<strong>Cập nhật lịch bay mùa hè:</strong> SangAir tăng tần suất các chuyến bay đến Đà Nẵng, Quy Nhơn, Phú Quốc từ 01/06 đến 30/08.', 1, 0),
('Ưu đãi thanh toán MoMo', 'Nhận ngay voucher giảm giá 50.000 VNĐ khi thanh toán vé máy bay qua ví điện tử MoMo.', 1, 1),
('Check-in Online tiện lợi', 'Làm thủ tục trực tuyến nhanh chóng, tiết kiệm thời gian tại sân bay. Mở trước 24 giờ so với giờ khởi hành.', 1, 2),
('Thông báo cũ (không hoạt động)', 'Chương trình khuyến mãi tháng 5 đã kết thúc.', 0, 3);
-- =================================================================
-- DỮ LIỆU MẪU BỔ SUNG ĐỂ TEST
-- =================================================================

-- Thêm 2 người dùng client mới
INSERT INTO users (id, full_name, email, password_hash, role) VALUES
(2, 'Nguyễn Văn An', 'nguyenvana@example.com', 'scrypt:32768:8:1$DL1seCgmwTgBtSDU$7c021d76e34edf6145efb1eaf98550a96863cad6d7a8bbb965664097a240d21f5b0715c290d1cc905aaccffde51225182dcccb892388a4eeae1ef17024127b23', 'client'),
(3, 'Trần Thị Bình', 'tranthib@example.com', 'scrypt:32768:8:1$DL1seCgmwTgBtSDU$7c021d76e34edf6145efb1eaf98550a96863cad6d7a8bbb965664097a240d21f5b0715c290d1cc905aaccffde51225182dcccb892388a4eeae1ef17024127b23', 'client');

-- Thêm một chuyến bay trong quá khứ để test báo cáo
INSERT INTO flights (flight_number, departure_airport_id, arrival_airport_id, departure_time, arrival_time, economy_price, business_price, first_class_price, total_seats, available_seats, status) VALUES
('SA20', (SELECT id FROM airports WHERE iata_code = 'SGN'), (SELECT id FROM airports WHERE iata_code = 'DAD'), datetime('now', '-10 days'), datetime('now', '-10 days', '+1 hours 20 minutes'), 1200000, 2500000, 4000000, 150, 150, 'landed');


-- Thêm 3 đặt chỗ mới với các trạng thái khác nhau
-- Đặt chỗ 1: Đã hoàn thành (của chuyến bay trong quá khứ)
INSERT INTO bookings (id, user_id, flight_id, booking_code, booking_time, num_adults, seat_class_booked, base_fare, ancillary_services_total, total_amount, payment_method, payment_status, status) VALUES
(101, 2, (SELECT id FROM flights WHERE flight_number = 'SA20'), 'SACOMP', datetime('now', '-12 days'), 2, 'Phổ thông', 2400000, 150000, 2550000, 'momo', 'paid', 'completed');

-- Đặt chỗ 2: Đã xác nhận (của chuyến bay sắp tới)
INSERT INTO bookings (id, user_id, flight_id, booking_code, booking_time, num_adults, seat_class_booked, base_fare, ancillary_services_total, total_amount, payment_method, payment_status, status) VALUES
(102, 3, (SELECT id FROM flights WHERE flight_number = 'SA1'), 'SACONF', datetime('now', '-2 days'), 1, 'Thương gia', 3000000, 0, 3000000, 'vnpay', 'paid', 'confirmed');

-- Đặt chỗ 3: Chờ thanh toán (của chuyến bay sắp tới)
INSERT INTO bookings (id, user_id, flight_id, booking_code, booking_time, num_adults, seat_class_booked, base_fare, ancillary_services_total, total_amount, payment_method, payment_status, status) VALUES
(103, 2, (SELECT id FROM flights WHERE flight_number = 'SA3'), 'SAPEND', datetime('now', '-1 hours'), 1, 'Phổ thông', 1100000, 0, 1100000, NULL, 'pending', 'pending_payment');

-- Thêm hành khách cho các đặt chỗ tương ứng
INSERT INTO passengers (booking_id, full_name, first_name, last_name, passenger_type) VALUES
(101, 'Nguyễn Văn An', 'An', 'Nguyễn Văn', 'adult'),
(101, 'Lê Thị Cúc', 'Cúc', 'Lê Thị', 'adult'),
(102, 'Trần Thị Bình', 'Bình', 'Trần Thị', 'adult'),
(103, 'Nguyễn Văn An', 'An', 'Nguyễn Văn', 'adult');

-- Thêm dịch vụ và suất ăn cho các đặt chỗ để test báo cáo
-- Dịch vụ hành lý cho booking 101
INSERT INTO booking_ancillary_services (booking_id, ancillary_service_id, price_at_booking) VALUES
(101, (SELECT id FROM ancillary_services WHERE name LIKE '%Hành lý%'), 150000);
-- Suất ăn cho booking 102
INSERT INTO booking_menu_items (booking_id, menu_item_id, price_at_booking) VALUES
(102, (SELECT id FROM menu_items WHERE name LIKE '%Mì Ý%'), 150000);




