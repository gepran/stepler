import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [action, deviceArgument] = process.argv.slice(2);
if (
  process.platform !== "darwin" ||
  !["test", "build", "install"].includes(action)
) {
  console.error(
    "Use npm run test:ios, build:ios or install:ios on a Mac with Xcode. install:ios accepts an optional device ID.",
  );
  process.exit(1);
}
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error || result.status !== 0) {
    if (capture) console.error(result.stderr);
    if (result.error) console.error(result.error.message);
    process.exit(result.status || 1);
  }
  return result.stdout;
}
const options = [
  "-project",
  "ios/Stepler.xcodeproj",
  "-scheme",
  "Stepler",
  "-derivedDataPath",
  "ios/DerivedData",
  "-clonedSourcePackagesDirPath",
  "ios/SourcePackages",
];
const output = mkdtempSync(join(tmpdir(), "stepler-ios-"));
if (action === "test") {
  const devices = Object.values(
    JSON.parse(
      run("xcrun", ["simctl", "list", "devices", "available", "--json"], true),
    ).devices,
  )
    .flat()
    .filter((device) => device.name.startsWith("iPhone"));
  const simulator =
    process.env.IOS_SIMULATOR_ID ||
    devices.find((device) => device.state === "Booted")?.udid ||
    devices[0]?.udid;
  if (!simulator) {
    console.error("Install an iOS simulator runtime in Xcode first.");
    process.exit(1);
  }
  run("xcodebuild", [
    ...options,
    "-destination",
    `platform=iOS Simulator,id=${simulator}`,
    "-resultBundlePath",
    join(output, "Tests.xcresult"),
    "test",
  ]);
} else {
  run("xcodebuild", [
    ...options,
    "-destination",
    "generic/platform=iOS",
    "-allowProvisioningUpdates",
    "build",
  ]);
  if (action === "install") {
    let device = deviceArgument || process.env.IOS_DEVICE_ID;
    if (!device) {
      const path = join(output, "devices.json");
      run("xcrun", ["devicectl", "list", "devices", "--json-output", path]);
      const devices = JSON.parse(
        readFileSync(path, "utf8"),
      ).result.devices.filter(
        (candidate) =>
          candidate.hardwareProperties.deviceType === "iPhone" &&
          candidate.connectionProperties.pairingState === "paired",
      );
      if (devices.length !== 1) {
        console.error(
          "Connect and pair your iPhone, or specify its device ID: npm run install:ios -- <device-id>",
        );
        process.exit(1);
      }
      device = devices[0].identifier;
    }
    run("xcrun", [
      "devicectl",
      "device",
      "install",
      "app",
      "--device",
      device,
      "ios/DerivedData/Build/Products/Debug-iphoneos/Stepler.app",
    ]);
    run("xcrun", [
      "devicectl",
      "device",
      "process",
      "launch",
      "--device",
      device,
      "com.stepler.app.ios",
    ]);
  }
}
