const fs = require("fs");
const path = require("path");

try {
  // Read existing package.json
  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  // Add firebase-admin dependency if not already present
  if (!packageJson.dependencies["firebase-admin"]) {
    packageJson.dependencies["firebase-admin"] = "^11.0.0";

    // Write updated package.json
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n"
    );

    console.log("Added firebase-admin to package.json dependencies");
    console.log('Please run "npm install" to install the new dependency');
  } else {
    console.log("firebase-admin is already in dependencies");
  }
} catch (error) {
  console.error("Error updating package.json:", error);
}
