module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["./tests/setup.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  testTimeout: 10000
};