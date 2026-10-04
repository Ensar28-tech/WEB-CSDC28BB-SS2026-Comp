// Registration and login:  POST /api/auth/register  and  POST /api/auth/login
import express from 'express';
import bcrypt from 'bcryptjs';
import { createToken, publicUser } from '../auth.js';

export function createAuthRouter(db) {
  const router = express.Router();

  // Body: { "username": "alice", "password": "secret123" }
  router.post('/register', async (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'The username needs 3 to 30 letters, digits, dots, dashes or underscores.' });
    }
    // bcrypt only reads the first 72 bytes of a password, so longer ones are refused.
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'The password needs 8 to 72 characters.' });
    }
    // Never store the password itself: bcrypt turns it into a salted hash that
    // can't be turned back. 10 = how much work one hash takes (slows down guessing).
    const passwordHash = await bcrypt.hash(password, 10);
    // Registration always creates a normal user. The admin is made in server.js.
    const user = db.createUser(username, passwordHash, 'user');
    if (!user) {
      return res.status(409).json({ error: 'This username is already taken.' });
    }
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  });

  // Body: { "username": "alice", "password": "secret123" }
  router.post('/login', async (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const user = db.findUserByUsername(username);
    // The same answer for an unknown name and a wrong password, so nobody can
    // find out which usernames exist.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Wrong username or password.' });
    }
    res.json({ token: createToken(user), user: publicUser(user) });
  });

  return router;
}
