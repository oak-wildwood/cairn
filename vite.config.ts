import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // Relative rather than root-absolute so the same build works whether
  // it's served from the domain root or a subpath — e.g. the PR preview
  // deploy at /cairn/pr-preview/pr-<n>/. An absolute base breaks there:
  // the browser resolves "/assets/..." from the domain root regardless
  // of which folder index.html sits in.
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
});
