"use strict";

function loadConfig(env) {
  const saved = { PORT: process.env.PORT, NODE_ENV: process.env.NODE_ENV };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env))
    if (v === undefined) delete process.env[k];
  try {
    let config;
    jest.isolateModules(() => {
      config = require("../../src/config");
    });
    return config;
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("config (§12)", () => {
  it("§12 PORT defaults to 3000", () => {
    expect(loadConfig({ PORT: undefined }).port).toBe(3000);
  });

  it("§12 reads PORT from the environment", () => {
    expect(loadConfig({ PORT: "4321" }).port).toBe(4321);
  });

  it("§12 rejects an invalid PORT", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow("Invalid PORT: abc");
    expect(() => loadConfig({ PORT: "70000" })).toThrow("Invalid PORT");
  });

  it("§12 NODE_ENV defaults to development", () => {
    const config = loadConfig({ NODE_ENV: undefined });
    expect(config.nodeEnv).toBe("development");
    expect(config.isTest).toBe(false);
  });

  it("§12 Jest runs with NODE_ENV=test", () => {
    expect(loadConfig({}).isTest).toBe(true);
  });
});
