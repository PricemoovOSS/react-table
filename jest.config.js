module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/test"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleDirectories: ["node_modules", "src"],
  globalSetup: "<rootDir>/test/global-test-setup.js",
  setupFilesAfterEnv: ["<rootDir>/test/setup-tests.ts"],
  // Fake timers in this codebase don't need to fake rAF — we polyfill it as synchronous in
  // setup-tests.ts so scroll-driven assertions can stay flush-and-check style.
  fakeTimers: { doNotFake: ["requestAnimationFrame", "cancelAnimationFrame"] },
  clearMocks: true,
  resetMocks: false,
};
