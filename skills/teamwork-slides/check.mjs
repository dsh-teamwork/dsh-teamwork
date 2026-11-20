#!/usr/bin/env node
// Checks a deck without a browser: node check.mjs <deck folder>. It runs deck.js and the checks block of
// template/index.html (the same code the page runs), and prints the problems as JSON: [] means none.
// It cannot measure rendered text; the page shrinks what is too long and reports what still does not fit.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const folder = resolve(process.argv[2] ?? '.');
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'template', 'index.html'), 'utf8');
const block = /\/\* checks:start[\s\S]*?\*\/([\s\S]*?)\/\* checks:end \*\//.exec(html)?.[1];
if (!block) throw new Error('template/index.html has no checks block');

let issues;
try {
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync(join(folder, 'deck.js'), 'utf8'), context, { filename: 'deck.js', timeout: 2000 });
  vm.runInContext(block, context, { timeout: 2000 });
  issues = vm.runInContext('checkDeck(window.DECK)', context, { timeout: 2000 });
} catch (error) {
  issues = [`deck.js does not run: ${error.message}`];
}
console.log(JSON.stringify(Array.from(issues), null, 1));
process.exitCode = issues.length ? 1 : 0;
