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

  console.log(`Re-signing ${appPath} with consistent ad-hoc signature...`);
  execSync(`codesign --force --deep --sign - "${appPath}"`, {
    stdio: "inherit",
  });
};
