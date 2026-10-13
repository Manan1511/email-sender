import { build } from 'esbuild'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

// Lambda disables require() of ES modules. Bundle the sanitizer's CommonJS
// entry and its ESM parser together, preserving the current security fixes.
await build({
  absWorkingDir: projectRoot,
  stdin: {
    contents: 'import sanitizeHtml from "sanitize-html"; export default sanitizeHtml;',
    sourcefile: 'sanitize-html-entry.mjs',
    resolveDir: projectRoot,
  },
  outfile: resolve(projectRoot, 'netlify/lib/sanitize-html.generated.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  logLevel: 'warning',
})
