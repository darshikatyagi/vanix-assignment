# Vanix Technologies — Backend Intern Assignment

## Overview

This project implements a backend service for ingesting encrypted IoT sensor packets, decrypting and validating packet data, storing readings in SQLite, and generating device alerts.

## Tech Stack

- Node.js
- Express.js
- SQLite with better-sqlite3
- AES-256-GCM decryption
- REST APIs

## Prerequisites

- Node.js 20 or later
- npm

## Setup Instructions

1. Clone the repository.
2. Open the backend directory.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file:

   ```env
   PORT=3000
   AES_KEY=your_64_character_hex_key
   ```

5. Replace the placeholder with the AES key supplied for the assignment. Do not commit `.env` or disclose the key.
6. Start the backend:

   ```bash
   node server.js
   ```

The server runs at `http://localhost:3000`.

## Database

SQLite database: `data/vanix.db`

The database contains:

- `devices` — registered devices and metadata.
- `encrypted_packets` — received encrypted packet data and duplicate status.
- `decrypted_packets` — successfully decrypted plaintext packets.
- `readings` — decoded sensor readings and activity scores.
- `alerts` — generated alerts and acknowledgement status.

The database is created automatically when the backend starts.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/ingest` | Ingest and process an encrypted packet |
| POST | `/api/devices` | Register a device |
| GET | `/api/devices` | List devices and their latest status |
| GET | `/api/devices/:id` | Get device details, latest reading, and alerts |
| GET | `/api/devices/:id/readings?from=&to=&page=1&limit=20` | Retrieve paginated readings |
| GET | `/api/alerts?status=open` | List open alerts |
| GET | `/api/alerts?status=acknowledged` | List acknowledged alerts |
| PATCH | `/api/alerts/:id` | Acknowledge an alert |

## Packet Processing

The ingestion workflow:

1. Receives the gateway ID and AES-GCM packet fields.
2. Decrypts the ciphertext using AES-256-GCM.
3. Validates the decrypted 256-byte packet.
4. Checks header, version, sample count, footer, and checksum.
5. Extracts device ID, sequence, timestamp, temperature, battery, label, and 16 XYZ samples.
6. Checks for duplicate device/sequence packets within the configured time window.
7. Stores unique decoded readings and evaluates alerts.

Invalid encrypted packets or invalid packet structures are rejected.

## Duplicate Detection

Duplicate detection uses the device ID, sequence number, and a two-minute timestamp window. The sequence number is treated as an unsigned byte, so sequence rollover from 255 to 0 is supported by the same time-window check.

## Activity Score and Alerts

The activity score is calculated as the average absolute difference between each sample's acceleration magnitude and 1000:

`magnitude = sqrt(x*x + y*y + z*z)`

`activityScore = average(abs(magnitude - 1000))`

Configured alert conditions:

- **Over-temperature:** temperature exceeds 40°C.
- **Offline:** no packet has been received for at least 30 minutes, based on packet timestamps.
- **Inactive:** average activity score is below the configured threshold of 50 milli-g.

The inactivity threshold is a configurable engineering assumption for this assignment and should be validated against the dataset's expected sensor behaviour.


## Testing

Start the backend in one terminal:

```bash
node server.js
```

Run the automated test suite from a second terminal:

```bash
npm test
```

The suite checks database initialization, sample packet decryption and decoding, decoder input validation, tampered ciphertext and authentication tag rejection, invalid packet ingestion, duplicate detection, API endpoints, alert verification, and sequence rollover data.

Additional individual tests can be run with:

```bash
node test-decrypt.js
node test-decoder.js
node test-tampered.js
node test-ingest.js
node test-api.js
node test-alerts.js
node test-sequence.js
node test-sequence-order.js
```

To replay the supplied dataset:

```bash
node replay.js --speed=60
```

A previous replay completed 1,574 requests without failures. Because the dataset had already been ingested, those requests were identified as duplicates.

## Current Limitations

- Sequence rollover is verified in the sample dataset, but a separate end-to-end ingestion test for a fresh `255 → 0` transition remains to be added.
- Alert verification confirms that required alert types exist and prevents duplicate open alerts in the checked results. Independent tests that trigger each alert threshold are still needed.
- Offline alert behavior should be tested independently against the assignment's event-time requirements.
- The inactivity threshold of 50 milli-g is an engineering assumption and should be validated against expected sensor behavior.


## Security and Repository Hygiene

- Keep `.env` out of version control.
- Do not commit the AES key.
- Do not commit `node_modules`.
- Do not commit generated SQLite database files.
- Use only the assignment-provided test data and encryption key.

