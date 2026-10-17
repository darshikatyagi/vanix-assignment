
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./database");
const { decryptPacket } = require("./decrypt");
const { decodePacket } = require("./decoder");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const INACTIVE_THRESHOLD = 50;
const OFFLINE_SECONDS = 30 * 60;
const DUPLICATE_WINDOW_SECONDS = 120;
const OFFLINE_CHECK_INTERVAL_MS = 60 * 1000;

// ==================================================
// Prepared statements
// ==================================================

const insertRaw = db.prepare(`
  INSERT INTO encrypted_packets
    (gateway_id, iv, ciphertext, tag, received_at)
  VALUES (?, ?, ?, ?, ?)
`);

const updateRaw = db.prepare(`
  UPDATE encrypted_packets
  SET packet_timestamp = ?, device_id = ?, sequence = ?, is_duplicate = ?
  WHERE id = ?
`);

const insertPlaintext = db.prepare(`
  INSERT INTO decrypted_packets (encrypted_packet_id, plaintext)
  VALUES (?, ?)
`);

const findDuplicate = db.prepare(`
  SELECT id
  FROM readings
  WHERE device_id = ?
    AND sequence = ?
    AND timestamp BETWEEN ? AND ?
  LIMIT 1
`);

const insertReading = db.prepare(`
  INSERT INTO readings
    (device_id, sequence, timestamp, temperature, battery,
     activity_score, samples)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ==================================================
// Activity score
// ==================================================

function calculateActivity(samples) {
  if (!Array.isArray(samples) || samples.length !== 16) {
    throw new Error("Exactly 16 motion samples are required");
  }

  const total = samples.reduce((sum, sample) => {
    const magnitude = Math.sqrt(
      sample.x ** 2 + sample.y ** 2 + sample.z ** 2
    );

    return sum + Math.abs(magnitude - 1000);
  }, 0);

  return total / samples.length;
}

// ==================================================
// Alert creation
// ==================================================

function raiseAlert(deviceId, type, message, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM alerts
    WHERE device_id = ?
      AND type = ?
      AND acknowledged = 0
    LIMIT 1
  `).get(deviceId, type);

  if (existing) {
    return false;
  }

  db.prepare(`
    INSERT INTO alerts (device_id, type, message, raised_at)
    VALUES (?, ?, ?, ?)
  `).run(deviceId, type, message, timestamp);

  return true;
}

// ==================================================
// Offline detection
// ==================================================

function checkOfflineDevices(referenceTimestamp = null) {
  const devices = db.prepare(`
    SELECT device_id
    FROM devices
  `).all();

  const latestPacket = db.prepare(`
    SELECT packet_timestamp AS last_seen, received_at
    FROM encrypted_packets
    WHERE device_id = ?
      AND packet_timestamp IS NOT NULL
    ORDER BY received_at DESC, id DESC
    LIMIT 1
  `);

  const nowMilliseconds = Date.now();

  for (const device of devices) {
    const packet = latestPacket.get(device.device_id);

    if (!packet || packet.last_seen === null) {
      continue;
    }

    const receivedAtMilliseconds = Date.parse(packet.received_at);

    if (!Number.isFinite(receivedAtMilliseconds)) {
      continue;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor(
        (nowMilliseconds - receivedAtMilliseconds) / 1000
      )
    );

    // For incoming packets, use the packet's event timestamp.
    // For scheduled checks, advance the latest packet timestamp by
    // the elapsed time since that packet was received.
    const eventNow = referenceTimestamp === null
      ? packet.last_seen + elapsedSeconds
      : Math.max(referenceTimestamp, packet.last_seen);

    if (eventNow - packet.last_seen >= OFFLINE_SECONDS) {
      raiseAlert(
        device.device_id,
        "offline",
        "No packet received for at least 30 minutes of event time",
        packet.last_seen + OFFLINE_SECONDS
      );
    }
  }
}

// ==================================================
// Alert evaluation
// ==================================================

function evaluateAlerts(deviceId, reading) {
  const { timestamp, temperature } = reading;

  // 1. Over-temperature alert.
  if (temperature > 40) {
    raiseAlert(
      deviceId,
      "over_temperature",
      `Temperature is ${temperature.toFixed(2)}°C, above 40°C`,
      timestamp
    );
  }

  // 2. Inactivity alert: average activity during the preceding hour.
  const activity = db.prepare(`
    SELECT AVG(activity_score) AS average
    FROM readings
    WHERE device_id = ?
      AND timestamp BETWEEN ? AND ?
  `).get(deviceId, timestamp - 3600, timestamp);

  if (
    activity.average !== null &&
    activity.average < INACTIVE_THRESHOLD
  ) {
    raiseAlert(
      deviceId,
      "inactive",
      `Average activity score is below ${INACTIVE_THRESHOLD} milli-g`,
      timestamp
    );
  }

  // 3. Check for offline devices using event time.
  checkOfflineDevices(timestamp);
}

// ==================================================
// Date/time parsing
// ==================================================

function parseUnixTime(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : NaN;
  }

  const milliseconds = Date.parse(value);

  return Number.isFinite(milliseconds)
    ? Math.floor(milliseconds / 1000)
    : NaN;
}

// ==================================================
// Health check
// ==================================================

app.get("/", (req, res) => {
  res.json({
    message: "Vanix Backend API is running successfully"
  });
});

// ==================================================
// POST /api/ingest
// Receive, decrypt, validate and store a packet.
// ==================================================

app.post("/api/ingest", (req, res) => {
  const body = req.body;

  if (
    !body ||
    typeof body.gatewayId !== "string" ||
    !body.gatewayId.trim() ||
    typeof body.iv !== "string" ||
    typeof body.ciphertext !== "string" ||
    typeof body.tag !== "string"
  ) {
    return res.status(400).json({
      error: "gatewayId, iv, ciphertext and tag are required"
    });
  }

  let rawId;

  try {
    // Preserve the encrypted packet, including invalid packets.
    rawId = insertRaw.run(
      body.gatewayId,
      body.iv,
      body.ciphertext,
      body.tag,
      new Date().toISOString()
    ).lastInsertRowid;
  } catch (error) {
    console.error("Could not store incoming packet:", error.message);

    return res.status(500).json({
      error: "Could not store incoming packet"
    });
  }

  let plaintext;
  let decoded;

  try {
    plaintext = decryptPacket(body);
    decoded = decodePacket(plaintext.data);
  } catch (error) {
    console.warn("Packet rejected:", error.message);

    return res.status(400).json({
      error: "Packet could not be decrypted or failed packet validation"
    });
  }

  try {
    const transaction = db.transaction(() => {
      insertPlaintext.run(rawId, JSON.stringify(plaintext));

      // Automatically register an unknown device.
      db.prepare(`
        INSERT INTO devices (device_id, label)
        VALUES (?, ?)
        ON CONFLICT(device_id) DO NOTHING
      `).run(decoded.deviceId, decoded.label);

      // Duplicate packets are identified by device, sequence,
      // and a timestamp window. Sequence numbers can wrap around.
      const duplicate = findDuplicate.get(
        decoded.deviceId,
        decoded.sequence,
        decoded.timestamp - DUPLICATE_WINDOW_SECONDS,
        decoded.timestamp + DUPLICATE_WINDOW_SECONDS
      );

      updateRaw.run(
        decoded.timestamp,
        decoded.deviceId,
        decoded.sequence,
        duplicate ? 1 : 0,
        rawId
      );

      if (duplicate) {
        return {
          duplicate: true,
          deviceId: decoded.deviceId,
          sequence: decoded.sequence
        };
      }

      const activityScore = calculateActivity(decoded.samples);

      insertReading.run(
        decoded.deviceId,
        decoded.sequence,
        decoded.timestamp,
        decoded.temperature,
        decoded.battery,
        activityScore,
        JSON.stringify(decoded.samples)
      );

      evaluateAlerts(decoded.deviceId, {
        timestamp: decoded.timestamp,
        temperature: decoded.temperature,
        activityScore
      });

      return {
        duplicate: false,
        deviceId: decoded.deviceId,
        sequence: decoded.sequence,
        timestamp: decoded.timestamp,
        temperature: decoded.temperature,
        battery: decoded.battery,
        activityScore
      };
    });

    const result = transaction();

    return res.status(200).json({
      message: result.duplicate
        ? "Duplicate packet stored; reading not repeated"
        : "Packet ingested successfully",
      ...result
    });
  } catch (error) {
    console.error("Packet processing failed:", error.message);

    return res.status(500).json({
      error: "Packet was decrypted but could not be stored or processed"
    });
  }
});

// ==================================================
// POST /api/devices
// Register a device.
// ==================================================

app.post("/api/devices", (req, res) => {
  const body = req.body || {};

  const {
    deviceId,
    label,
    location = "",
    installDate = null
  } = body;

  if (
    !Number.isSafeInteger(deviceId) ||
    deviceId < 0 ||
    deviceId > 0xffffffff ||
    typeof label !== "string" ||
    !label.trim() ||
    typeof location !== "string" ||
    (
      installDate !== null &&
      (
        typeof installDate !== "string" ||
        !Number.isFinite(Date.parse(installDate))
      )
    )
  ) {
    return res.status(400).json({
      error: "Provide a valid deviceId, non-empty label, location string and valid installDate"
    });
  }

  try {
    db.prepare(`
      INSERT INTO devices (device_id, label, location, install_date)
      VALUES (?, ?, ?, ?)
    `).run(
      deviceId,
      label.trim(),
      location.trim(),
      installDate
    );

    return res.status(201).json({
      message: "Device registered",
      deviceId
    });
  } catch (error) {
    if (
      error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
      error.code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      return res.status(409).json({
        error: "Device already exists"
      });
    }

    console.error("Device registration failed:", error.message);

    return res.status(500).json({
      error: "Could not register device"
    });
  }
});

// ==================================================
// GET /api/devices
// List devices and their latest readings.
// ==================================================

app.get("/api/devices", (req, res) => {
  const devices = db.prepare(`
    SELECT
      d.device_id AS deviceId,
      d.label,
      d.location,
      d.install_date AS installDate,

      (
        SELECT r.temperature
        FROM readings r
        WHERE r.device_id = d.device_id
        ORDER BY r.timestamp DESC, r.id DESC
        LIMIT 1
      ) AS latestTemperature,

      (
        SELECT r.activity_score
        FROM readings r
        WHERE r.device_id = d.device_id
        ORDER BY r.timestamp DESC, r.id DESC
        LIMIT 1
      ) AS activityScore,

      (
        SELECT r.timestamp
        FROM readings r
        WHERE r.device_id = d.device_id
        ORDER BY r.timestamp DESC, r.id DESC
        LIMIT 1
      ) AS lastSeen,

      EXISTS (
        SELECT 1
        FROM alerts a
        WHERE a.device_id = d.device_id
          AND a.acknowledged = 0
      ) AS hasOpenAlert

    FROM devices d
    ORDER BY d.device_id
  `).all();

  res.json(devices);
});

// ==================================================
// GET /api/devices/:id
// Device details, latest reading and open alerts.
// ==================================================

app.get("/api/devices/:id", (req, res) => {
  const deviceId = Number(req.params.id);

  if (!Number.isSafeInteger(deviceId) || deviceId < 0) {
    return res.status(400).json({
      error: "Invalid device ID"
    });
  }

  const device = db.prepare(`
    SELECT *
    FROM devices
    WHERE device_id = ?
  `).get(deviceId);

  if (!device) {
    return res.status(404).json({
      error: "Device not found"
    });
  }

  const latestReading = db.prepare(`
    SELECT *
    FROM readings
    WHERE device_id = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT 1
  `).get(deviceId);

  const alerts = db.prepare(`
    SELECT *
    FROM alerts
    WHERE device_id = ?
      AND acknowledged = 0
    ORDER BY raised_at DESC, id DESC
  `).all(deviceId);

  res.json({
    device,
    latestReading: latestReading || null,
    alerts
  });
});

// ==================================================
// GET /api/devices/:id/readings
// Optional query parameters: from, to, page, limit
// ==================================================

app.get("/api/devices/:id/readings", (req, res) => {
  const deviceId = Number(req.params.id);
  const from = parseUnixTime(req.query.from);
  const to = parseUnixTime(req.query.to);

  const pageRaw =
    req.query.page === undefined ? 1 : Number(req.query.page);

  const limitRaw =
    req.query.limit === undefined ? 20 : Number(req.query.limit);

  if (
    !Number.isSafeInteger(deviceId) ||
    deviceId < 0 ||
    (req.query.from !== undefined && !Number.isFinite(from)) ||
    (req.query.to !== undefined && !Number.isFinite(to)) ||
    (from !== null && to !== null && from > to) ||
    !Number.isInteger(pageRaw) ||
    pageRaw < 1 ||
    !Number.isInteger(limitRaw) ||
    limitRaw < 1 ||
    limitRaw > 100
  ) {
    return res.status(400).json({
      error: "Invalid device ID, time range, page or limit"
    });
  }

  const device = db.prepare(`
    SELECT device_id
    FROM devices
    WHERE device_id = ?
  `).get(deviceId);

  if (!device) {
    return res.status(404).json({
      error: "Device not found"
    });
  }

  const fromValue = from === null ? 0 : from;
  const toValue = to === null ? Number.MAX_SAFE_INTEGER : to;
  const offset = (pageRaw - 1) * limitRaw;

  const readings = db.prepare(`
    SELECT *
    FROM readings
    WHERE device_id = ?
      AND timestamp BETWEEN ? AND ?
    ORDER BY timestamp DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(
    deviceId,
    fromValue,
    toValue,
    limitRaw,
    offset
  );

  const total = db.prepare(`
    SELECT COUNT(*) AS count
    FROM readings
    WHERE device_id = ?
      AND timestamp BETWEEN ? AND ?
  `).get(
    deviceId,
    fromValue,
    toValue
  ).count;

  res.json({
    deviceId,
    page: pageRaw,
    limit: limitRaw,
    total,
    totalPages: Math.ceil(total / limitRaw),
    readings
  });
});

// ==================================================
// GET /api/alerts?status=open
// Supported statuses: open, acknowledged, all
// ==================================================

app.get("/api/alerts", (req, res) => {
  const status = req.query.status || "open";

  if (!["open", "acknowledged", "all"].includes(status)) {
    return res.status(400).json({
      error: "status must be open, acknowledged or all"
    });
  }

  let alerts;

  if (status === "open") {
    alerts = db.prepare(`
      SELECT *
      FROM alerts
      WHERE acknowledged = 0
      ORDER BY raised_at DESC, id DESC
    `).all();
  } else if (status === "acknowledged") {
    alerts = db.prepare(`
      SELECT *
      FROM alerts
      WHERE acknowledged = 1
      ORDER BY raised_at DESC, id DESC
    `).all();
  } else {
    alerts = db.prepare(`
      SELECT *
      FROM alerts
      ORDER BY raised_at DESC, id DESC
    `).all();
  }

  res.json(alerts);
});

// ==================================================
// PATCH /api/alerts/:id
// Acknowledge an alert.
// ==================================================

app.patch("/api/alerts/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Invalid alert ID"
    });
  }

  const alert = db.prepare(`
    SELECT *
    FROM alerts
    WHERE id = ?
  `).get(id);

  if (!alert) {
    return res.status(404).json({
      error: "Alert not found"
    });
  }

  if (!alert.acknowledged) {
    db.prepare(`
      UPDATE alerts
      SET acknowledged = 1,
          acknowledged_at = ?
      WHERE id = ?
    `).run(
      Math.floor(Date.now() / 1000),
      id
    );
  }

  res.json({
    message: "Alert acknowledged",
    id
  });
});

// ==================================================
// Error handler
// ==================================================

app.use((error, req, res, next) => {
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      error: "Request body contains invalid JSON"
    });
  }

  console.error("Unexpected server error:", error.message);

  return res.status(500).json({
    error: "Internal server error"
  });
});

// ==================================================
// Start server
// ==================================================

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// ==================================================
// Scheduled offline detection
// ==================================================

const offlineCheckTimer = setInterval(() => {
  try {
    checkOfflineDevices();
  } catch (error) {
    console.error("Scheduled offline check failed:", error.message);
  }
}, OFFLINE_CHECK_INTERVAL_MS);

// Prevent the timer alone from keeping a test process alive.
offlineCheckTimer.unref();

// ==================================================
// Graceful shutdown
// ==================================================

function shutdown() {
  clearInterval(offlineCheckTimer);

  server.close(() => {
    try {
      db.close();
    } finally {
      process.exit(0);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
