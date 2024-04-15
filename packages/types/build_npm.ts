import { build, emptyDir } from 'https://deno.land/x/dnt@0.38.0/mod.ts';

const outDir = './npm';
const lernaPackageJSON: { version: string } = JSON.parse(
  await Deno.readTextFile('./package.json'),
);

await emptyDir(outDir);

await build({
  entryPoints: [
    { name: '.', path: './src/index.ts' },
  ],
  outDir,
  shims: {},
  // Keeping declarations in a single types/ directory to mimic the original file structure
  declaration: 'separate',
  test: false,
  // package.json values
  package: {
    name: '@simplewebauthn/types',
    version: lernaPackageJSON.version,
    description: 'TypeScript types used by the @simplewebauthn series of libraries',
    license: 'MIT',
    author: 'Matthew Miller <matthew@millerti.me>',
    repository: {
      type: 'git',
      url: 'git+https://github.com/MasterKale/SimpleWebAuthn.git',
      directory: 'packages/types',
    },
    homepage: 'https://github.com/MasterKale/SimpleWebAuthn/tree/master/packages/types#readme',
    publishConfig: {
      access: 'public',
    },
    bugs: {
      url: 'https://github.com/MasterKale/SimpleWebAuthn/issues',
    },
    keywords: [
      'typescript',
      'webauthn',
      'passkeys',
      'fido',
      'types',
    ],
  },
});

Deno.copyFileSync('LICENSE.md', `${outDir}/LICENSE.md`);
Deno.copyFileSync('README.md', `${outDir}/README.md`);
