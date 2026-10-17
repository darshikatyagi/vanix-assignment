
const fs = require("node:fs");

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("\n--- Packet Ingestion Tests ---\n");

  // Test 1: Reject a packet with invalid encryption fields.
  const invalidResponse = await fetch(`${BASE_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gatewayId: "GW-TEST",
      iv: "invalid",
      ciphertext: "invalid",
      tag: "invalid"
    })
  });

  console.log("Invalid packet status:", invalidResponse.status);

  if (invalidResponse.status !== 400) {
    throw new Error("Invalid packet should return HTTP 400");
  }

  // Test 2: Re-send a packet from the supplied dataset.
  // It should already exist because the dataset has been replayed.
  const packets = JSON.parse(
    fs.readFileSync("./data/encrypted_packets.json", "utf8")
  );

  const packet = packets[0].body;

  const duplicateResponse = await fetch(`${BASE_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(packet)
  });

  const duplicateResult = await duplicateResponse.json();

  console.log("Duplicate packet status:", duplicateResponse.status);
  console.log("Duplicate result:", duplicateResult);

  if (
    duplicateResponse.status !== 200 ||
    duplicateResult.duplicate !== true
  ) {
    throw new Error("Previously ingested packet should be detected as duplicate");
  }

  console.log("\nAll packet ingestion tests passed.");
}

runTests().catch((error) => {
  console.error("\nPacket ingestion test failed:", error.message);
  process.exitCode = 1;
});
