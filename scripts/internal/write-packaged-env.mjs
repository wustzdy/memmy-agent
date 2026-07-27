#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const [sourcePath, outputPath] = process.argv.slice(2);

if (!sourcePath || !outputPath) {
  throw new Error("Usage: write-packaged-env.mjs <source.env> <output.env>");
}

const blockedKeys = new Set(["MEMMY_GA4_API_SECRET"]);
const requiredKeys = new Set(["MEMMY_CLOUD_SERVICE"]);
const source = readFileSync(sourcePath, "utf8");
const outputLines = [];
const outputKeys = new Set();

for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  if (!match) {
    continue;
  }

  const key = match[1];
  if (blockedKeys.has(key)) {
    continue;
  }

  outputKeys.add(key);
  outputLines.push(line.replace(/\r$/, ""));
}

for (const key of requiredKeys) {
  if (!outputKeys.has(key)) {
    throw new Error(`Packaged env is missing required key: ${key}`);
  }
}

for (const key of blockedKeys) {
  if (outputKeys.has(key)) {
    throw new Error(`Packaged env contains blocked key: ${key}`);
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${outputLines.join("\n")}\n`);
