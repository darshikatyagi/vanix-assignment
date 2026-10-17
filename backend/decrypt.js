
const crypto = require("node:crypto");

function decryptPacket(body) {
  const keyHex = process.env.AES_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("AES_KEY must be a valid 32-byte hex key");
  }

  if (
    !body ||
    typeof body.iv !== "string" ||
    typeof body.ciphertext !== "string" ||
    typeof body.tag !== "string"
  ) {
    throw new Error("Invalid encrypted packet fields");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(body.iv, "base64");
  const ciphertext = Buffer.from(body.ciphertext, "base64");
  const tag = Buffer.from(body.tag, "base64");

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid IV or authentication tag length");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  const plaintext = decrypted.toString("utf8");
  const packet = JSON.parse(plaintext);

  return packet;
}

module.exports = { decryptPacket };
