// Bundles the server entry points into single ESM files (dist/*.mjs) so the production image
// ships no node_modules: small enough to push through the registry's proxy, faster to pull.
import { build } from 'esbuild';

await build({
  entryPoints: {
    index: 'src/index.ts',
    worker: 'src/worker.ts',
    migrate: 'src/db/migrate.ts',
    admin: 'src/cli/admin.ts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  splitting: false,
  minify: false,
  legalComments: 'external',
  // pg's optional native driver is never installed.
  external: ['pg-native'],
  // CommonJS dependencies still call require(), __dirname and __filename.
  banner: {
    js: [
      "import { createRequire as __gymCreateRequire } from 'node:module';",
      "import { fileURLToPath as __gymFileURLToPath } from 'node:url';",
      "import { dirname as __gymDirname } from 'node:path';",
      'const require = __gymCreateRequire(import.meta.url);',
      'const __filename = __gymFileURLToPath(import.meta.url);',
      'const __dirname = __gymDirname(__filename);',
    ].join('\n'),
  },
  logLevel: 'warning',
});
console.log('bundled dist/{index,worker,migrate,admin}.mjs');
