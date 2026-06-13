import assert from 'node:assert/strict';
import { copyFile, cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const packageRoot = path.resolve(new URL('..', import.meta.url).pathname);
const workDir = await mkdtemp(path.join(tmpdir(), 'cloptima-llm-js-install-'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || workDir,
    env: { ...process.env, npm_config_cache: path.join(workDir, 'npm-cache') },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

try {
  const packageCopy = path.join(workDir, 'package');
  await mkdir(packageCopy);
  await copyFile(path.join(packageRoot, 'package.json'), path.join(packageCopy, 'package.json'));
  await copyFile(path.join(packageRoot, 'tsconfig.json'), path.join(packageCopy, 'tsconfig.json'));
  await cp(path.join(packageRoot, 'src'), path.join(packageCopy, 'src'), { recursive: true });
  await cp(path.join(packageRoot, 'examples'), path.join(packageCopy, 'examples'), { recursive: true });
  const packageJson = JSON.parse(await readFile(path.join(packageCopy, 'package.json'), 'utf8'));
  packageJson.devEngines = undefined;
  assert.deepEqual(packageJson.exports['.'], {
    types: './dist/src/index.d.ts',
    import: './dist/src/index.js',
  });
  await writeFile(path.join(packageCopy, 'package.json'), JSON.stringify(packageJson, null, 2));

  run('npm', ['install', '--ignore-scripts'], { cwd: packageCopy });
  run('npm', ['run', 'build'], { cwd: packageCopy });
  const pack = run('npm', ['pack', '--json'], { cwd: packageCopy });
  let packedFilename;
  let packedFiles = [];
  try {
    const packed = JSON.parse(pack.stdout)[0];
    packedFilename = packed.filename;
    packedFiles = packed.files.map((file) => file.path);
  } catch {
    packedFilename = pack.stdout.trim().split(/\r?\n/).at(-1);
  }
  const tarball = path.join(packageCopy, packedFilename);
  if (packedFiles.length === 0) {
    packedFiles = run('tar', ['-tf', tarball], { cwd: packageCopy })
      .stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
  }
  assert.ok(packedFiles.some((file) => file.endsWith('dist/src/index.js')));
  assert.ok(packedFiles.some((file) => file.endsWith('dist/src/index.d.ts')));
  assert.ok(packedFiles.some((file) => file.endsWith('examples/basic.mjs')));
  assert.ok(packedFiles.some((file) => file.endsWith('examples/custom-wrapper.mjs')));
  assert.ok(packedFiles.some((file) => file.endsWith('examples/fetch-wrapper.mjs')));
  assert.ok(!packedFiles.some((file) => file.startsWith('test/')));

  const freshProject = path.join(workDir, 'fresh-project');
  await mkdir(freshProject);
  await writeFile(path.join(freshProject, 'package.json'), JSON.stringify({ type: 'module', dependencies: {} }));
  run('npm', ['install', '--ignore-scripts', tarball], { cwd: freshProject });
  await writeFile(path.join(freshProject, 'index.mjs'), `
    import { initFromEnv } from '@cloptima/llm-observability';
    const client = initFromEnv({
      env: {
        CLOPTIMA_LLM_OBSERVABILITY_API_KEY: 'pat-test',
        CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
        CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: 'dev',
      },
      fetchImpl: async () => new Response('{}', { status: 202 }),
    });
    if (client.stats().queuedEvents !== 0) throw new Error('unexpected initial stats');
  `);
  run('node', ['index.mjs'], { cwd: freshProject });
  const exampleDir = path.join(freshProject, 'node_modules/@cloptima/llm-observability/examples');
  const examples = (await readdir(exampleDir))
    .filter((file) => file.endsWith('.mjs'))
    .sort();
  for (const example of examples) {
    run('node', [path.join(exampleDir, example)], { cwd: freshProject });
  }
  assert.ok(true);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
