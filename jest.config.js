const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./site" });

module.exports = createJestConfig({});
