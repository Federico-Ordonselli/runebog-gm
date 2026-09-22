const { spawn } = require('node:child_process');
const electron = require('electron');

const child = spawn(electron, ['.'], {
  cwd: __dirname,
  env: { ...process.env, RUNEBOG_SMOKE_TEST: '1' },
  stdio: 'inherit',
});
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 30000);
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode = 1; });
child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 1; });
