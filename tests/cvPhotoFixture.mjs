import { deflateSync } from 'node:zlib';

// Synthetic avatar used only for photo upload and PDF tests.
function chunk(type, bytes) {
  const payload = Buffer.concat([Buffer.from(type), bytes]); let crc = 0xffffffff;
  for (const value of payload) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}
const size = 64;
const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
const pixels = Buffer.alloc((size * 3 + 1) * size);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const person = ((x - 32) ** 2 + (y - 23) ** 2 < 100) || (y > 38 && (x - 32) ** 2 / 400 + (y - 63) ** 2 / 625 < 1);
  const color = person ? [236, 241, 245] : [62, 90, 112];
  color.forEach((value, index) => { pixels[y * (size * 3 + 1) + 1 + x * 3 + index] = value; });
}
export const cvPhotoFixture = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
