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
  // Under Vitest, resolve Svelte's client runtime rather than its server one.
  // The server build turns `$effect` into a no-op and `mount` into an error,
  // so without this a test of anything reactive would pass or fail for
  // reasons that have nothing to do with how the app runs in a browser.
  resolve: process.env.VITEST ? { conditions: ["browser"] } : undefined,
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
    // Node by default, so a module that quietly starts depending on the DOM
    // fails loudly here instead of passing on jsdom's say-so. The files that
    // genuinely need `localStorage`/`location` opt in with a
    // `// @vitest-environment jsdom` docblock at the top.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
