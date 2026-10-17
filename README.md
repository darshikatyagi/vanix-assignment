# Vanix Technologies — Backend Intern Assignment

A device-monitoring application that processes encrypted sensor packets, stores device readings, detects alerts, and provides a mobile interface for monitoring devices.

## Project Structure

```text
vanix-assignment/
├── backend/          # Node.js API, packet processing, database, tests
├── mobile/           # Expo / React Native application
├── mobile_flutter/   # Flutter device-monitoring application
└── README.md
```

## Backend

The backend uses Node.js, Express, SQLite, and AES-256-GCM decryption.

### Features

- Ingest and decrypt encrypted sensor packets.
- Validate packet structure, version, header, footer, and checksum.
- Store device information and sensor readings in SQLite.
- Detect duplicate packets using device ID, sequence number, and a timestamp window.
- Generate alerts for high temperature, device inactivity, and offline devices.
- Retrieve devices, readings, and alerts through REST API endpoints.
- Acknowledge alerts through the API.

### Setup

Prerequisites: Node.js and npm.

1. Open a terminal in the `backend` directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file using the configuration described in `backend/README.md`. Keep the encryption key private and never commit `.env`.
4. Start the server:

   ```bash
   node server.js
   ```

5. In a separate terminal, run the backend tests:

   ```bash
   npm test
   ```

### Packet Replay

With the backend server running, execute the replay script from the `backend` directory:

```bash
node replay.js --speed=60
```

The replay script sends the supplied encrypted packet dataset to the ingestion endpoint. Previously ingested packets may be recognized as duplicates.

Refer to `backend/README.md` for API endpoints, configuration details, testing instructions, packet decoding, and implementation assumptions.

## Mobile Applications

### Flutter

The `mobile_flutter/` directory contains the device-monitoring interface, including:

- Device dashboard and registered devices.
- Device details and sensor-reading history.
- Alert listing and acknowledgement.
- Paginated reading history.

Use the Flutter SDK to run the application. See `mobile_flutter/README.md` for project-specific instructions.

### Expo / React Native

The `mobile/` directory contains an Expo / React Native project. Refer to its README for setup instructions.

## Testing

Backend:

```bash
cd backend
npm test
```

Flutter:

```bash
cd mobile_flutter
flutter analyze
flutter test
```

## Assumptions and Limitations

- Alert thresholds and activity-score calculations follow the assumptions documented in the backend README.
- The supplied dataset contains historical event timestamps, so recent-reading views may be empty when no readings fall within the selected time window.
- Duplicate detection means replaying an already processed dataset may not create new readings.
- See `backend/README.md` for additional implementation limitations and testing details.

## Security

- Never commit `.env` files, encryption keys, credentials, or local database files.
- Keep secrets outside source control.
- Use appropriate repository access permissions when sharing the assignment.

## Author

Darshika Tyagi

Vanix Technologies — Backend Intern Assignment
