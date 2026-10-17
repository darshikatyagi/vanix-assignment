
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { decryptPacket } = require("./decrypt");
const { decodePacket } = require("./decoder");

const packets = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "data", "encrypted_packets.json"),
    "utf8"
  )
);

const targetDevice = 70003;
const decodedPackets = [];

for (const packet of packets) {
  try {
    const plaintext = decryptPacket(packet.body);
    const decoded = decodePacket(plaintext.data);

    if (decoded.deviceId === targetDevice) {
      decodedPackets.push(decoded);
    }
  } catch (error) {
    console.error("Packet decode failed:", error.message);
  }
}

decodedPackets.sort((a, b) => a.timestamp - b.timestamp);

let found = false;

for (let i = 1; i < decodedPackets.length; i++) {
  const previous = decodedPackets[i - 1];
  const current = decodedPackets[i];

  if (previous.sequence === 255 && current.sequence === 0) {
    console.log("PASS: Found sequence rollover!");
    console.log({
      deviceId: current.deviceId,
      previousSequence: previous.sequence,
      previousTimestamp: previous.timestamp,
      currentSequence: current.sequence,
      currentTimestamp: current.timestamp,
      timeDifferenceSeconds: current.timestamp - previous.timestamp,
    });

    found = true;
    break;
  }
}

if (!found) {
  console.log(
    "No consecutive 255 → 0 transition found for device",
    targetDevice
  );
}
