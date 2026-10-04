// Login tokens (JWT) and the two "guards" (middleware) that protect routes.
import jwt from 'jsonwebtoken';
import { config } from './config.js';

// A token is a signed note saying "this is user <id>". Only the server knows the
// secret, so nobody can forge or change a token. It expires after config.tokenLifetime.
export function createToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.tokenLifetime });
}

// Middleware: lets a request through only with a valid token, and puts the user on req.user.
// The browser sends the token in the header "Authorization: Bearer <token>".
export function requireLogin(db) {
  return (req, res, next) => {
    const [scheme, token] = (req.get('Authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Please log in first.' });
    }
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret); // throws when forged or expired
    } catch {
      return res.status(401).json({ error: 'Your login has expired. Please log in again.' });
    }
    // The role is read from the database, not from the token, so the database is
    // always the one place that decides who is an admin.
    const user = db.findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Please log in first.' });
    }
    req.user = user;
    next();
  };
}

// Middleware: admins only. It runs after requireLogin, which has set req.user.
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can do this.' });
  }
  next();
}

// What the browser may see of a user: never the password hash.
export function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role };
}
