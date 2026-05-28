import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, "../src/chrome-extension/icons");

const sizes = [16, 48, 128];

async function generateIcons() {
  for (const size of sizes) {
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" rx="24" fill="#1e293b"/>
      <rect x="8" y="8" width="112" height="112" rx="20" fill="#0f172a" stroke="#3b82f6" stroke-width="3"/>
      <text x="64" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="36" fill="#3b82f6">AI</text>
      <text x="64" y="82" text-anchor="middle" font-family="Arial, sans-serif" font-weight="600" font-size="20" fill="#94a3b8">Resume</text>
      <rect x="30" y="92" width="68" height="4" rx="2" fill="#22c55e"/>
    </svg>`;

    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon${size}.png`));

    console.log(`Generated icon${size}.png`);
  }
}

generateIcons().catch(console.error);
