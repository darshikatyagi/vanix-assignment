
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

const { decryptPacket } = require("./decrypt");
const { decodePacket } = require("./decoder");

const filePath = path.join(
  __dirname,
  "data",
  "encrypted_packets.json"
);

try {
  const packets = JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );

  console.log("Total packets:", packets.length);

  const firstPacket = packets[0];
  const decrypted = decryptPacket(firstPacket.body);
  const decoded = decodePacket(decrypted.data);

  console.log("\nDecryption successful!");
  console.log("Decoded packet:");
  console.log(JSON.stringify(decoded, null, 2));
} catch (error) {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
}
