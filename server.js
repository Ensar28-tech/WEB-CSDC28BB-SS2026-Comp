// Starts the server. `npm start` runs this file.
import bcrypt from 'bcryptjs';
import { createApp } from './src/app.js';
import { config } from './src/config.js';
import { Database } from './src/db.js';
import * as openAlex from './src/openalex.js';

const db = new Database(config.dataFile);
await createAdminIfMissing();

const app = createApp({ db, openAlex });
app.listen(config.port, () => {
  console.log(`Paper Reading List is running on http://localhost:${config.port}`);
});

// Registration only ever creates normal users. The admin account is created here,
// on the first start, from ADMIN_USERNAME and ADMIN_PASSWORD (see src/config.js).
async function createAdminIfMissing() {
  if (!process.env.JWT_SECRET) {
    console.warn('JWT_SECRET is not set: using the built-in development secret.');
  }
  if (db.hasAdmin()) return;
  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  const admin = db.createUser(config.adminUsername, passwordHash, 'admin');
  if (admin) {
    console.log(`Created the admin account "${config.adminUsername}".`);
  } else {
    console.warn(`Could not create the admin: the username "${config.adminUsername}" is taken.`);
  }
}
