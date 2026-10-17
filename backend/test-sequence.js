
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const { decryptPacket } = require("./decrypt");
const { decodePacket } = require("./decoder");

const filePath = path.join(
  __dirname,
  "data",
  "encrypted_packets.json"
);

const packets = JSON.parse(
  fs.readFileSync(filePath, "utf8")
);

const sequencesByDevice = new Map();

for (const packet of packets) {
  try {
    const decrypted = decryptPacket(packet.body);
    const decoded = decodePacket(decrypted.data);

    if (!sequencesByDevice.has(decoded.deviceId)) {
      sequencesByDevice.set(decoded.deviceId, new Set());
    }

    sequencesByDevice.get(decoded.deviceId).add(decoded.sequence);
  } catch (error) {
    console.error("Could not decode a packet:", error.message);
  }
}

let found = false;

for (const [deviceId, sequences] of sequencesByDevice) {
  if (sequences.has(255) && sequences.has(0)) {
    console.log(
      `PASS: Device ${deviceId} contains sequence 255 and sequence 0.`
    );
    found = true;
  }
}

if (!found) {
  console.log(
    "The dataset does not contain both sequence 255 and sequence 0 for the same device."
  );
  console.log("Devices and sequence ranges:");

  for (const [deviceId, sequences] of sequencesByDevice) {
    const sorted = [...sequences].sort((a, b) => a - b);

    console.log(
      `Device ${deviceId}: minimum=${sorted[0]}, maximum=${sorted[sorted.length - 1]}, unique sequences=${sorted.length}`
    );
  }
}
