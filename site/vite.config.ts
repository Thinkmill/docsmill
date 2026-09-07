import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

function preloadLargeRouteAssets(): Plugin {
  return {
    name: "docsmill-preload-large-route-assets",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(_html, context) {
        const files = Object.keys(context.bundle ?? {});
        const find = (pattern: RegExp) => {
          const filename = files.find((file) => pattern.test(file));
          if (filename === undefined) {
            throw new Error(`Could not find preload asset matching ${pattern}`);
          }
          return `/${filename}`;
        };
        const preloadAssets = {
          packageWorker: find(/\/package\.worker-[^/]+\.js$/),
          sourceWorker: find(/\/source\.worker-[^/]+\.js$/),
          treeSitter: find(/\/web-tree-sitter-[^/]+\.wasm$/),
          grammars: Object.fromEntries(
            [
              "css",
              "html",
              "javascript",
              "json",
              "markdown",
              "tsx",
              "typescript",
            ].map((language) => [
              language,
              find(new RegExp(`/tree-sitter-${language}-[^/]+\\.wasm$`)),
            ]),
          ),
        };
        const assetsJson = JSON.stringify(preloadAssets).replaceAll(
          "<",
          "\\u003c",
        );
        const script = `(()=>{const a=${assetsJson};const p=location.pathname;const add=(href,module)=>{const l=document.createElement("link");l.rel=module?"modulepreload":"preload";l.href=href;l.crossOrigin="anonymous";if(!module){l.as="fetch";l.type="application/wasm"}document.head.append(l)};if(p==="/"||p.startsWith("/npm/")){add(a.packageWorker,true);return}if(!p.startsWith("/src/"))return;add(a.sourceWorker,true);const ext=p.split("/").at(-1)?.split(".").at(-1)?.toLowerCase();const lang=({css:"css",html:"html",js:"javascript",jsx:"javascript",mjs:"javascript",cjs:"javascript",json:"json",md:"markdown",ts:"typescript",cts:"typescript",mts:"typescript",tsx:"tsx"})[ext];if(lang){add(a.treeSitter,false);add(a.grammars[lang],false)}})();`;
        return [{ tag: "script", children: script, injectTo: "head-prepend" }];
      },
    },
  };
}

export default defineConfig({
  worker: { format: "es" },
  resolve: {
    // The package's browser export uses document.createElement, but the default
    // implementation is data-only and works in both windows and Web Workers.
    alias: {
      "decode-named-character-reference": fileURLToPath(
        new URL(
          "./node_modules/decode-named-character-reference/index.js",
          import.meta.url,
        ),
      ),
    },
  },
  define: {
    __dirname: JSON.stringify("/worker"),
    __filename: JSON.stringify("/worker/index.js"),
  },
  plugins: [
    preloadLargeRouteAssets(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
  ],
});
