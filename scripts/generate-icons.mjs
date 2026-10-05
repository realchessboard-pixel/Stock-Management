// Generates PWA / favicon PNGs from one SVG. Run: node scripts/generate-icons.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";

// Barcode glyph on a brand-blue square. `pad` shrinks the glyph for maskable icons
// (Android crops maskable icons to a circle/squircle; keep content in the safe zone).
const svg = (pad, rounded) => {
  const s = 512;
  const inner = s - pad * 2;
  const bars = [
    [0, 10], [16, 6], [28, 14], [50, 6], [62, 6], [76, 16], [100, 6], [114, 10], [132, 6], [146, 14], [168, 6], [182, 10],
  ];
  const scale = (inner * 0.62) / 192;
  const x0 = pad + (inner - 192 * scale) / 2;
  const y0 = pad + inner * 0.25;
  const h = inner * 0.38;
  const rects = bars.map(([x, w]) => `<rect x="${x0 + x * scale}" y="${y0}" width="${w * scale}" height="${h}" rx="${2 * scale}" fill="#fff"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="#1f63e0"/>
    ${rects}
    <rect x="${x0}" y="${y0 + h + inner * 0.06}" width="${192 * scale}" height="${inner * 0.05}" rx="${inner * 0.025}" fill="#fff" opacity="0.85"/>
  </svg>`;
};

const out = [
  ["public/icons/icon-192.png", 192, svg(40, true)],
  ["public/icons/icon-512.png", 512, svg(40, true)],
  ["public/icons/maskable-512.png", 512, svg(110, false)],
  ["public/icons/apple-touch-icon.png", 180, svg(40, false)],
  ["public/icons/favicon-32.png", 32, svg(20, true)],
];
for (const [file, size, s] of out) {
  writeFileSync(file, await sharp(Buffer.from(s)).resize(size, size).png({ compressionLevel: 9 }).toBuffer());
  console.log("wrote", file);
}
writeFileSync("public/icons/icon.svg", svg(40, true));
