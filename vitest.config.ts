import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Separate from vite.config.ts because that one's `build.rollupOptions.input`
// wires up the app's two HTML entry points (main + demo), which has nothing
// to do with running tests and would only confuse vitest.
export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
