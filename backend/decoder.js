
function decodePacket(data) {
  // 1. Validate the input
  if (
    !Array.isArray(data) ||
    data.length !== 256 ||
    !data.every(
      (value) =>
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 255
    )
  ) {
    throw new Error(
      "Packet must contain exactly 256 integers from 0 to 255"
    );
  }

  const buffer = Buffer.from(data);

  // 2. Validate header, version and footer
  if (buffer[0] !== 0xA5 || buffer[1] !== 0x5A) {
    throw new Error("Invalid packet header");
  }

  if (buffer[2] !== 2) {
    throw new Error("Unsupported packet version");
  }

  if (buffer[254] !== 0x5A || buffer[255] !== 0xA5) {
    throw new Error("Invalid packet footer");
  }

  if (buffer[15] !== 16) {
    throw new Error("Invalid sample count");
  }

  // 3. Validate checksum
  let sum = 0;

  for (let i = 0; i <= 251; i++) {
    sum += buffer[i];
  }

  const calculatedChecksum = sum % 65536;
  const storedChecksum = buffer.readUInt16LE(252);

  if (calculatedChecksum !== storedChecksum) {
    throw new Error("Checksum mismatch");
  }

  // 4. Decode device information
  const sequence = buffer[3];
  const deviceId = buffer.readUInt32LE(4);
  const timestamp = buffer.readUInt32LE(8);
  const temperature = buffer.readInt16LE(12) / 100;
  const battery = buffer[14];

  // 5. Decode the 16 motion samples
  const samples = [];

  for (let n = 0; n < 16; n++) {
    const offset = 16 + n * 6;

    samples.push({
      x: buffer.readInt16LE(offset),
      y: buffer.readInt16LE(offset + 2),
      z: buffer.readInt16LE(offset + 4)
    });
  }

  // 6. Decode the ASCII device label
  const label = buffer
    .toString("ascii", 112, 128)
    .replace(/\0+$/, "");

  return {
    sequence,
    deviceId,
    timestamp,
    temperature,
    battery,
    label,
    samples,
    checksum: storedChecksum
  };
}

module.exports = { decodePacket };
