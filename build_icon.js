const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function buildIcon() {
    const inputSvg = path.join(__dirname, 'logo.svg');

    // Make sure to output to both build and resources to be safe
    const buildDir = path.join(__dirname, 'build');
    const resDir = path.join(__dirname, 'resources');

    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);
    if (!fs.existsSync(resDir)) fs.mkdirSync(resDir);

    const iconPaths = [
        path.join(buildDir, 'icon.png'),
        path.join(resDir, 'icon.png')
    ];

    for (const outPath of iconPaths) {
        await sharp(inputSvg)
            .resize(1024, 1024)
            .png()
            .toFile(outPath);
        console.log(`Generated ${outPath}`);
    }
}

buildIcon().catch(console.error);
