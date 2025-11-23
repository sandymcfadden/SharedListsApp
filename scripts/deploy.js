// scripts/deploy.js
import { writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to the project root
const rootPath = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootPath, '.env.local');
const envPath = path.join(rootPath, '.env');

// Load environment variables (local overrides default)
if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('Loaded environment from .env.local');
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('Loaded environment from .env');
} else {
  console.warn(
    '⚠️ No .env.local or .env file found, continuing without custom domain.'
  );
}

// Run vite build
execSync('vite build', { stdio: 'inherit' });

// Ensure we have a domain
const domain = process.env.VITE_CUSTOM_DOMAIN;
if (!domain) {
  console.error(
    '❌ Missing VITE_CUSTOM_DOMAIN in your environment file (.env.local or .env)'
  );
  process.exit(1);
}

// Write the CNAME file
writeFileSync(path.join(rootPath, 'dist', 'CNAME'), domain);
console.log(`✅ CNAME file created with: ${domain}`);

// Deploy with gh-pages
execSync('gh-pages -d dist', { stdio: 'inherit' });
