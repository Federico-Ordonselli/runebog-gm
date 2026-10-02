const { spawn } = require('node:child_process');
const electron = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const profilo = fs.mkdtempSync(path.join(os.tmpdir(), 'runebog-smoke-'));
const pulisci = () => fs.rmSync(profilo, { recursive: true, force: true });

const child = spawn(electron, ['.'], {
  cwd: __dirname,
  env: { ...process.env, RUNEBOG_SMOKE_TEST: '1', RUNEBOG_SMOKE_PROFILE: profilo },
  stdio: 'inherit',
});
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 30000);
child.on('error', error => { clearTimeout(timer); pulisci(); console.error(error); process.exitCode = 1; });
child.on('exit', code => { clearTimeout(timer); pulisci(); process.exitCode = code ?? 1; });
