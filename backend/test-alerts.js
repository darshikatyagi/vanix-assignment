
const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("\n--- Alert rule verification ---\n");

  const response = await fetch(`${BASE_URL}/api/alerts?status=all`);

  if (!response.ok) {
    throw new Error(`Alerts API returned ${response.status}`);
  }

  const alerts = await response.json();

  if (!Array.isArray(alerts)) {
    throw new Error("Alerts API did not return an array");
  }

  const requiredTypes = [
    "over_temperature",
    "inactive",
    "offline",
  ];

  const actualTypes = new Set(alerts.map((alert) => alert.type));

  for (const type of requiredTypes) {
    if (!actualTypes.has(type)) {
      throw new Error(`Missing required alert type: ${type}`);
    }

    console.log(`PASS: ${type} alert exists.`);
  }

  const openAlerts = alerts.filter((alert) => !alert.acknowledged);
  const seen = new Set();

  for (const alert of openAlerts) {
    const key = `${alert.device_id}:${alert.type}`;

    if (seen.has(key)) {
      throw new Error(
        `Duplicate open alert: device ${alert.device_id}, type ${alert.type}`
      );
    }

    seen.add(key);
  }

  console.log("PASS: No duplicate open alerts.");
  console.log(`PASS: Checked ${alerts.length} total alerts.`);
  console.log("\nAll alert verification tests passed.");
}

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
