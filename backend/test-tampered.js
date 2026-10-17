
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

const originalPacket = packets[0].body;

async function sendPacket(body) {
  const response = await fetch("http://localhost:3000/api/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json();

  return {
    status: response.status,
    body: responseBody,
  };
}

async function main() {
  // Test 1: Modify the ciphertext.
  const tamperedCiphertext = {
    ...originalPacket,
    ciphertext:
      (originalPacket.ciphertext[0] === "0" ? "1" : "0") +
      originalPacket.ciphertext.slice(1),
  };

  const ciphertextResult = await sendPacket(tamperedCiphertext);

  if (ciphertextResult.status !== 400) {
    throw new Error(
      `Tampered ciphertext test failed: ${JSON.stringify(ciphertextResult)}`
    );
  }

  console.log("PASS: Tampered ciphertext was rejected.");

  // Test 2: Modify the authentication tag.
  const tamperedTag = {
    ...originalPacket,
    tag:
      (originalPacket.tag[0] === "0" ? "1" : "0") +
      originalPacket.tag.slice(1),
  };

  const tagResult = await sendPacket(tamperedTag);

  if (tagResult.status !== 400) {
    throw new Error(
      `Tampered authentication tag test failed: ${JSON.stringify(tagResult)}`
    );
  }

  console.log("PASS: Tampered authentication tag was rejected.");

  console.log("All tampered-packet tests passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
