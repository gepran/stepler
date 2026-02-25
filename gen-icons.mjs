import sharp from "sharp";
import fs from "fs";

async function generate() {
  const svg = fs.readFileSync("build/icon.svg");

  // Create 1024x1024 PNG
  await sharp(svg).resize(1024, 1024).png().toFile("build/icon.png");

  console.log("Generated build/icon.png");
}

generate().catch(console.error);
