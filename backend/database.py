import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "anpr.db")

os.makedirs(DATA_DIR, exist_ok=True)

def get_connection():
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS vehicle_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT,
        vehicle_class TEXT,
        vehicle_color TEXT,
        camera_id TEXT,
        location TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        image_path TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS rc_vehicles (
        plate_number TEXT PRIMARY KEY,
        vehicle_class TEXT,
        vehicle_color TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS stolen_vehicles (
        plate_number TEXT PRIMARY KEY,
        theft_time DATETIME
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT,
        alert_type TEXT,
        description TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()
