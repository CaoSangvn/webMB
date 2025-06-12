# app/models/stats_model.py
import sqlite3
from flask import current_app
from datetime import datetime, timedelta

def _get_db_connection():
    conn = sqlite3.connect(current_app.config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def get_overview_stats(start_date_str, end_date_str):
    conn = _get_db_connection()
    stats = {}
    try:
        # 1. Tổng doanh thu
        revenue_query = """
            SELECT SUM(total_amount) as total_revenue
            FROM bookings
            WHERE status IN ('confirmed', 'completed', 'payment_received')
              AND date(booking_time) BETWEEN ? AND ?
        """
        revenue_result = conn.execute(revenue_query, (start_date_str, end_date_str)).fetchone()
        stats['total_revenue'] = revenue_result['total_revenue'] if revenue_result['total_revenue'] else 0

        # 2. Tổng số đặt chỗ
        total_bookings_query = "SELECT COUNT(id) as total_bookings FROM bookings WHERE date(booking_time) BETWEEN ? AND ?"
        bookings_result = conn.execute(total_bookings_query, (start_date_str, end_date_str)).fetchone()
        stats['total_bookings'] = bookings_result['total_bookings'] if bookings_result else 0

        # 3. Chuyến bay hoạt động
        active_flights_query = "SELECT COUNT(id) as active_flights FROM flights WHERE status = 'scheduled' AND date(departure_time) >= date('now', 'localtime')"
        flights_result = conn.execute(active_flights_query).fetchone()
        stats['active_flights'] = flights_result['active_flights'] if flights_result else 0

        # 4. Khách hàng mới
        new_customers_query = "SELECT COUNT(id) as new_customers FROM users WHERE date(created_at) BETWEEN ? AND ?"
        customers_result = conn.execute(new_customers_query, (start_date_str, end_date_str)).fetchone()
        stats['new_customers'] = customers_result['new_customers'] if customers_result else 0
        return stats
    finally:
        if conn: conn.close()

def get_booking_status_chart_data(start_date_str, end_date_str):
    conn = _get_db_connection()
    try:
        query = "SELECT status, COUNT(id) as count FROM bookings WHERE date(booking_time) BETWEEN ? AND ? GROUP BY status;"
        cursor = conn.execute(query, (start_date_str, end_date_str))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        if conn: conn.close()

def get_top_routes_data(start_date_str, end_date_str, limit=5):
    conn = _get_db_connection()
    try:
        query = """
            SELECT
                dep_airport.iata_code || ' → ' || arr_airport.iata_code as itinerary,
                COUNT(b.id) as booking_count
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            JOIN airports dep_airport ON f.departure_airport_id = dep_airport.id
            JOIN airports arr_airport ON f.arrival_airport_id = arr_airport.id
            WHERE b.status IN ('confirmed', 'completed', 'payment_received')
              AND date(b.booking_time) BETWEEN ? AND ?
            GROUP BY itinerary
            ORDER BY booking_count DESC
            LIMIT ?;
        """
        cursor = conn.execute(query, (start_date_str, end_date_str, limit))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        if conn: conn.close()