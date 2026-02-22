const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

async function buildIcon() {
    const inputSvg = path.join(__dirname, "logo.svg");
    const buildDir = path.join(__dirname, "build");
    const resDir = path.join(__dirname, "resources");

    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);
    if (!fs.existsSync(resDir)) fs.mkdirSync(resDir);

    // 1. Generate standard 1024x1024 PNGs
    const iconPaths = [
        path.join(buildDir, "icon.png"),
        path.join(resDir, "icon.png"),
    ];

    for (const outPath of iconPaths) {
        await sharp(inputSvg).resize(1024, 1024).png().toFile(outPath);
        console.log(`Generated ${outPath}`);
    }

    // 2. Generate macOS .icns file if on macOS
    if (process.platform === "darwin") {
        const iconsetDir = path.join(buildDir, "icon.iconset");
        if (!fs.existsSync(iconsetDir)) fs.mkdirSync(iconsetDir);

        const sizes = [
            { size: 16, name: "icon_16x16.png" },
            { size: 32, name: "icon_16x16@2x.png" },
            { size: 32, name: "icon_32x32.png" },
            { size: 64, name: "icon_32x32@2x.png" },
            { size: 128, name: "icon_128x128.png" },
            { size: 512, name: "icon_128x128@2x.png" },
            { size: 256, name: "icon_256x256.png" },
            { size: 512, name: "icon_256x256@2x.png" },
            { size: 512, name: "icon_512x512.png" },
            { size: 1024, name: "icon_512x512@2x.png" },
        ];

        console.log("Generating iconset sizes...");
        for (const { size, name } of sizes) {
            await sharp(inputSvg)
                .resize(size, size)
                .png()
                .toFile(path.join(iconsetDir, name));
        }

        try {
            console.log("Running iconutil to generate icon.icns...");
            execSync(
                `iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, "icon.icns")}"`,
            );
            console.log(`Generated ${path.join(buildDir, "icon.icns")}`);
        } catch (err) {
            console.error("Error running iconutil:", err.message);
        } finally {
            // Clean up iconset directory
            fs.rmSync(iconsetDir, { recursive: true, force: true });
        }
    }
}

buildIcon().catch(console.error);
