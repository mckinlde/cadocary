import { defineConfig } from "vitest/config";

// Vitest is the test runner for the pure domain layer and (later) component
// tests. Property-based tests use fast-check (a dev dependency) to exercise the
// pure functions across many generated inputs.
export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.{test,spec}.ts", "src/**/*.{test,spec}.ts"],
    environment: "node",
  },
});
