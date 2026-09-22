const { buildSync } = require('esbuild');
const path = require('node:path');

buildSync({
  entryPoints: [path.join(__dirname, 'projector.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(__dirname, 'projector.cjs'),
});
