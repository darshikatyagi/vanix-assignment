
const { decodePacket } = require("./decoder");
const fs = require("node:fs");
const path = require("node:path");

const packetsPath = path.join(
  __dirname,
  "data",
  "encrypted_packets.json"
);

const packets = JSON.parse(
  fs.readFileSync(packetsPath, "utf8")
);

function expectFailure(name, data, expectedMessage) {
  try {
    decodePacket(data);
    throw new Error(`${name}: packet was incorrectly accepted`);
  } catch (error) {
    if (error.message.includes("incorrectly accepted")) {
      throw error;
    }

    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(
        `${name}: unexpected error: ${error.message}`
      );
    }

    console.log(`PASS: ${name}`);
  }
}

function main() {
  // Find the decrypted binary packet from the existing test data.
  // The dataset contains encrypted packets, so use test-decrypt.js
  // to confirm how the plaintext packet is represented.
  console.log("Testing decoder input validation...");

  expectFailure(
    "Reject packet that is too short",
    Array(255).fill(0),
    "exactly 256"
  );

  expectFailure(
    "Reject packet that is too long",
    Array(257).fill(0),
    "exactly 256"
  );

  const invalidValue = Array(256).fill(0);
  invalidValue[10] = 256;

  expectFailure(
    "Reject byte values greater than 255",
    invalidValue,
    "integers from 0 to 255"
  );

  const invalidType = Array(256).fill(0);
  invalidType[10] = 1.5;

  expectFailure(
    "Reject non-integer byte values",
    invalidType,
    "integers from 0 to 255"
  );

  const invalidHeader = Array(256).fill(0);
  invalidHeader[0] = 0;
  invalidHeader[1] = 0;

  expectFailure(
    "Reject invalid packet header",
    invalidHeader,
    "Invalid packet header"
  );

  console.log("All decoder validation tests passed.");
}

main();
