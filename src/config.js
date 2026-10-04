// All settings in one place. Each one can be changed with an environment variable
// or a line in a .env file; the defaults let the app run without any setup.
import path from 'node:path';

const projectRoot = path.join(import.meta.dirname, '..');

// Node reads a .env file by itself, no extra package needed. The file is optional.
try {
  process.loadEnvFile(path.join(projectRoot, '.env'));
} catch {
  // No .env file: the defaults below are used.
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-me',
  tokenLifetime: '2h',
  // A relative path counts from the project folder, wherever the server is started from.
  dataFile: path.resolve(projectRoot, process.env.DATA_FILE || 'data/db.json'),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  openAlexApiKey: process.env.OPENALEX_API_KEY || '',
};
