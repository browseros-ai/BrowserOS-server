/**
 * @license
 * Copyright 2025 BrowserOS
 */
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const serverJson = JSON.parse(fs.readFileSync('./server.json', 'utf-8'));

serverJson.version = packageJson.version;
for (const pkg of serverJson.packages) {
  pkg.version = packageJson.version;
}

fs.writeFileSync('./server.json', JSON.stringify(serverJson, null, 2));
