const { spawnSync } = require('node:child_process');
const path = require('node:path');

const failedMigration = '20260918000000_init';
const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const prismaCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status ?? 1);
  }

  return result;
}

const status = run(prismaCommand, ['--no-install', 'prisma', 'migrate', 'status', '--schema', schemaPath], { capture: true, allowFailure: true });
const statusOutput = `${status.stdout ?? ''}\n${status.stderr ?? ''}`;
process.stdout.write(statusOutput);

if (statusOutput.includes(failedMigration) && /failed/i.test(statusOutput)) {
  run(prismaCommand, [
    '--no-install',
    'prisma',
    'migrate',
    'resolve',
    '--rolled-back',
    failedMigration,
    '--schema',
    schemaPath,
  ]);
}

run(prismaCommand, ['--no-install', 'prisma', 'migrate', 'deploy', '--schema', schemaPath]);
run(prismaCommand, ['--no-install', 'prisma', 'db', 'seed']);

const api = spawnSync(process.execPath, [path.resolve(__dirname, '../dist/apps/api/src/main.js')], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

if (api.error) throw api.error;
process.exit(api.status ?? 1);
