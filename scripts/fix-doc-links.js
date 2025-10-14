#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const docsRoot = path.resolve(process.cwd(), 'docs');

function walkMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function extractTitle(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = /^#\s+(.+)/.exec(line.trim());
    if (match) return match[1].trim();
  }
  return '(senza titolo)';
}

function formatDate(filePath) {
  const stat = fs.statSync(filePath);
  return stat.mtime.toISOString().replace('T', ' ').slice(0, 16);
}

const linkRegex = /(\[[^\]]+\])\(((?!https?:|mailto:|#|ftp:|tel:|data:)[^)]+)\)/g;

function normalizeLinks(filePath, content) {
  const dir = path.dirname(filePath);
  let updated = content;
  updated = updated.replace(linkRegex, (full, label, target) => {
    const raw = target.trim();
    if (!raw) return full;
    let href = raw;
    let hash = '';
    const hashIndex = raw.indexOf('#');
    if (hashIndex >= 0) {
      href = raw.slice(0, hashIndex);
      hash = raw.slice(hashIndex);
    }
    const resolved = path.resolve(dir, href || '.');
    if (!resolved.startsWith(docsRoot)) {
      return full;
    }
    let relative = path.relative(dir, resolved);
    if (!relative) {
      relative = '.';
    }
    if (!relative.startsWith('.')) {
      relative = `./${relative}`;
    }
    relative = relative.replace(/\\/g, '/');
    return `${label}(${relative}${hash})`;
  });
  return updated;
}

function runInventory(files) {
  const header = ['# Index documentazione', '', '| Titolo | Path | Ultima modifica |', '| --- | --- | --- |'];
  const rows = files.map((file) => {
    const title = extractTitle(file);
    const relPath = path.relative(docsRoot, file).replace(/\\/g, '/');
    const mtime = formatDate(file);
    return `| ${title} | ${relPath} | ${mtime} |`;
  });
  console.log([...header, ...rows, ''].join('\n'));
}

function runWrite(files) {
  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const updated = normalizeLinks(file, content);
    if (updated !== content) {
      fs.writeFileSync(file, updated, 'utf8');
    }
  });
}

if (args.includes('--inventory')) {
  const files = walkMarkdownFiles(docsRoot);
  runInventory(files);
  process.exit(0);
}

if (args.includes('--write')) {
  const files = walkMarkdownFiles(docsRoot);
  runWrite(files);
  process.exit(0);
}

console.error('Usage: node scripts/fix-doc-links.js [--inventory|--write]');
process.exit(1);
