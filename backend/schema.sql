
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS devices (
    device_id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    location TEXT DEFAULT '',
    install_date TEXT,
    registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS encrypted_packets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gateway_id TEXT NOT NULL,
    iv TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    tag TEXT NOT NULL,
    received_at TEXT NOT NULL,
    packet_timestamp INTEGER,
    device_id INTEGER,
    sequence INTEGER,
    is_duplicate INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS decrypted_packets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encrypted_packet_id INTEGER NOT NULL UNIQUE,
    plaintext TEXT NOT NULL,
    FOREIGN KEY (encrypted_packet_id)
        REFERENCES encrypted_packets(id)
);

CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    sequence INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    temperature REAL NOT NULL,
    battery INTEGER NOT NULL,
    activity_score REAL NOT NULL,
    samples TEXT NOT NULL,
    UNIQUE(device_id, sequence, timestamp),
    FOREIGN KEY (device_id)
        REFERENCES devices(device_id)
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    raised_at INTEGER NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_at INTEGER,
    FOREIGN KEY (device_id)
        REFERENCES devices(device_id)
);

CREATE INDEX IF NOT EXISTS idx_readings_device_time
    ON readings(device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_packets_device_sequence
    ON encrypted_packets(device_id, sequence);

CREATE INDEX IF NOT EXISTS idx_alerts_device_status
    ON alerts(device_id, acknowledged);
