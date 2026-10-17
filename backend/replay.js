
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

const API_URL =
  process.env.API_URL || "http://localhost:3000";

const filePath = path.join(
  __dirname,
  "data",
  "encrypted_packets.json"
);

const speedArg = process.argv.find((arg) =>
  arg.startsWith("--speed=")
);

const speed = speedArg
  ? Number(speedArg.split("=")[1])
  : 60;

if (!Number.isFinite(speed) || speed <= 0) {
  console.error("Speed must be a positive number.");
  process.exit(1);
}

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function replay() {
  const packets = JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );

  packets.sort(
    (a, b) =>
      new Date(a.sentAt).getTime() -
      new Date(b.sentAt).getTime()
  );

  console.log(`Loaded ${packets.length} packets.`);
  console.log(`Replay speed: ${speed}x`);

  let successful = 0;
  let failed = 0;
  let duplicates = 0;

  let previousTime = null;

  for (let i = 0; i < packets.length; i++) {
    const packet = packets[i];
    const currentTime = new Date(packet.sentAt).getTime();

    if (previousTime !== null) {
      const delay = Math.max(
        0,
        (currentTime - previousTime) / speed
      );

      if (delay > 0) {
        await sleep(delay);
      }
    }

    previousTime = currentTime;

    try {
      const response = await fetch(
        `${API_URL}/api/ingest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(packet.body)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        failed++;
        console.error(
          `Packet ${packet.id} failed (${response.status}):`,
          result.error
        );
      } else {
        successful++;

        if (result.duplicate) {
          duplicates++;
        }
      }
    } catch (error) {
      failed++;
      console.error(
        `Packet ${packet.id} request failed:`,
        error.message
      );
    }

    if ((i + 1) % 100 === 0 || i === packets.length - 1) {
      console.log(
        `Progress: ${i + 1}/${packets.length} | ` +
        `Successful: ${successful} | ` +
        `Failed: ${failed} | ` +
        `Duplicates: ${duplicates}`
      );
    }
  }

  console.log("\nReplay finished.");
  console.log({ successful, failed, duplicates });
}

replay().catch((error) => {
  console.error("Replay stopped:", error.message);
  process.exitCode = 1;
});
