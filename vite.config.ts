import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => ({
  // Relative rather than root-absolute so the same build works whether
  // it's served from the domain root (Vercel previews) or a subpath
  // (production, at /cairn/ on GitHub Pages). An absolute base breaks on
  // the subpath: the browser resolves "/assets/..." from the domain root
  // regardless of which folder index.html sits in.
  base: "./",
  plugins: [svelte()],
  // Under Vitest, resolve Svelte's browser build rather than its server one,
  // so `.svelte.ts` runes and components run as they do in the app rather
  // than as SSR output.
  resolve: mode === "test" ? { conditions: ["browser"] } : undefined,
  test: {
    include: ["src/**/*.test.ts"],
    // Node by default: most of the suite is pure maths. A file that needs a
    // DOM opts in with a `// @vitest-environment jsdom` docblock.
    environment: "node",
  },
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
}));
