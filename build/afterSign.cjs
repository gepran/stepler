const { execSync } = require("child_process");
const path = require("path");

exports.default = async function (context) {
  if (process.platform !== "darwin") return;

  if (context.packager.platform.name !== "mac") {
    console.log(
      `Skipping ad-hoc signing for ${context.packager.platform.name} target`,
    );
    return;
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  // --options runtime is the point of this line as much as the signature is.
  // Without the hardened runtime, DYLD_INSERT_LIBRARIES is honoured
  // unconditionally: anything already running as the user could load a library
  // into an app that holds Accessibility and Apple Events grants and has
  // already decrypted the Google, Jira and Firebase tokens. The entitlements
  // are named explicitly because the re-sign replaces whatever electron-builder
  // applied, and the JIT ones are what V8 needs to run at all.
  const entitlements = path.join(__dirname, "entitlements.mac.plist");
  console.log(`Re-signing ${appPath} ad-hoc, with the hardened runtime...`);
  execSync(
    `codesign --force --deep --options runtime --entitlements "${entitlements}" --sign - "${appPath}"`,
    { stdio: "inherit" },
  );
};
