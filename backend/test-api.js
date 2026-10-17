
const BASE_URL = "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = await response.json();

  console.log(
    `${options.method || "GET"} ${path}: ${response.status}`,
    body
  );

  return { response, body };
}

async function runTests() {
  console.log("\n--- Backend API tests ---\n");

  // 1. List devices
  let result = await request("/api/devices");
  if (!result.response.ok || !Array.isArray(result.body)) {
    throw new Error("Device list test failed");
  }

  // 2. Device details
  result = await request("/api/devices/70002");
  if (!result.response.ok) {
    throw new Error("Device details test failed");
  }

  // 3. Paginated readings
  result = await request("/api/devices/70002/readings?limit=5");
  if (
    !result.response.ok ||
    result.body.limit !== 5 ||
    result.body.readings.length > 5
  ) {
    throw new Error("Readings pagination test failed");
  }

  // 4. Open alerts
  result = await request("/api/alerts?status=open");
  if (!result.response.ok || !Array.isArray(result.body)) {
    throw new Error("Open alerts test failed");
  }

  // 5. Invalid alert ID
  result = await request("/api/alerts/999999", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acknowledged: true })
  });

  if (result.response.ok) {
    throw new Error("Invalid alert ID should not succeed");
  }

  console.log("\nAll API tests passed.");
}

runTests().catch((error) => {
  console.error("\nTest failed:", error.message);
  process.exitCode = 1;
});

