import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // Relative rather than root-absolute so the same build works whether
  // it's served from the domain root or a subpath — e.g. the PR preview
  // deploy at /cairn/pr-preview/pr-<n>/. An absolute base breaks there:
  // the browser resolves "/assets/..." from the domain root regardless
  // of which folder index.html sits in.
  base: "./",
  plugins: [svelte()],
});
