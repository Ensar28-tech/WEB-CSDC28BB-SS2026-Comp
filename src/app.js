// Builds the Express application: middleware, the REST API under /api, and the web pages.
import path from 'node:path';
import express from 'express';
import { OpenAlexError } from './openalex.js';
import { createAdminRouter } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { createPapersRouter } from './routes/papers.js';
import { createReadingListRouter } from './routes/readingList.js';

// db and openAlex are handed in instead of imported, so the tests can pass a
// temporary database and a fake OpenAlex.
export function createApp({ db, openAlex }) {
  const app = express();

  app.use(express.json()); // turns a JSON request body into req.body
  app.use(express.static(path.join(import.meta.dirname, '..', 'public'))); // the web pages

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/papers', createPapersRouter(openAlex)); // Feature 1
  app.use('/api/reading-list', createReadingListRouter(db, openAlex)); // Feature 2
  app.use('/api/admin', createAdminRouter(db, openAlex)); // Feature 3

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'There is no such API address.' });
  });

  // The error handler: Express recognises it by its four parameters. Express 5 sends
  // every error here, also one thrown inside an async route.
  app.use((error, req, res, next) => {
    if (error instanceof OpenAlexError) {
      console.warn(error.message);
      return res.status(502).json({ error: 'OpenAlex is not available right now. Please try again.' });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'The request body is not valid JSON.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
