import { mkdirSync, writeFileSync } from "node:fs";
import bwipjs from "bwip-js/node";

/**
 * Writes a tiny Y4M video showing the Code 128 barcode SF00000001 (the first
 * generated barcode of every new shop). Chromium plays it as the camera.
 * Pure JS: no ffmpeg needed on CI.
 */
export default function globalSetup() {
  const W = 640;
  const H = 480;
  const MODULE = 4;
  const [{ sbs }] = bwipjs.raw({ bcid: "code128", text: "SF00000001" }) as unknown as { sbs: number[] }[];
  const total = sbs.reduce((a, b) => a + b, 0) * MODULE;
  const x0 = Math.floor((W - total) / 2);

  const y = new Uint8Array(W * H).fill(235); // white
  let x = x0;
  sbs.forEach((width, i) => {
    const px = width * MODULE;
    if (i % 2 === 0) for (let row = 160; row < 320; row++) y.fill(16, row * W + x, row * W + x + px); // black bar
    x += px;
  });
  const chroma = new Uint8Array((W / 2) * (H / 2)).fill(128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  mkdirSync("tests/e2e/.tmp", { recursive: true });
  writeFileSync("tests/e2e/.tmp/cam.y4m", Buffer.concat([header, ...Array.from({ length: 10 }, () => frame)]));
}
