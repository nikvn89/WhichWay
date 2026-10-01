import { build } from 'esbuild'

await build({
  entryPoints: [new URL('../src/lib/utils.ts', import.meta.url).pathname],
  outfile: new URL('./.generated-utils.mjs', import.meta.url).pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'silent',
})
