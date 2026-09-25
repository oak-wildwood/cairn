import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
// `vitest/config`'s `defineConfig` is `vite`'s with a `test` key added, so this
// stays the one Vite config for both the app and its tests rather than two
// configs that could drift apart.
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // Relative rather than root-absolute so the same build works whether
  // it's served from the domain root (Vercel previews) or a subpath
  // (production, at /cairn/ on GitHub Pages). An absolute base breaks on
  // the subpath: the browser resolves "/assets/..." from the domain root
  // regardless of which folder index.html sits in.
  base: "./",
  plugins: [svelte()],
  build: {
    rollupOptions: {
      // The demo page (see demo/index.html) is a second static entry, not
      // a client-side route — this host is GitHub Pages, which has no
      // server to rewrite a path like /demo to index.html. Listing it here
      // is what makes `npm run build` emit dist/demo/index.html as a real
      // file that Pages can serve directly.
      input: {
        main: `${root}index.html`,
        demo: `${root}demo/index.html`,
      },
    },
  },
  test: {
    // jsdom, not node: persistence.ts reads `localStorage` and `location`,
    // and the store touches both at import time.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
