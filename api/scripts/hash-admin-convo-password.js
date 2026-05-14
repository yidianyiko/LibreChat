#!/usr/bin/env node

const bcrypt = require('bcryptjs');

const readStdin = () =>
  new Promise((resolve, reject) => {
    let input = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('error', reject);
    process.stdin.on('end', () => resolve(input));
  });

const trimTrailingNewline = (value) => value.replace(/\r?\n$/, '');

const main = async () => {
  const password = trimTrailingNewline(await readStdin());

  if (password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const hash = await bcrypt.hash(password, 12);
  process.stdout.write(`${hash}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
