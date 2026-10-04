// Feature 2 – Personal reading list. Every route needs a logged-in user (User or Admin)
// and only ever touches that user's own entries (req.user.id).
import express from 'express';
import { requireLogin } from '../auth.js';
import { isWorkId } from '../paper.js';

export function createReadingListRouter(db, openAlex) {
  const router = express.Router();
  router.use(requireLogin(db)); // guards every route below

  // GET /api/reading-list  ->  the papers this user saved
  router.get('/', (req, res) => {
    res.json(db.readingListOf(req.user.id));
  });

  // POST /api/reading-list   Body: { "paperId": "W2741809807" }  ->  save a paper
  router.post('/', async (req, res) => {
    const paperId = String(req.body?.paperId ?? '').trim().toUpperCase();
    if (!isWorkId(paperId)) {
      return res.status(400).json({ error: 'paperId must be an OpenAlex work id such as W2741809807.' });
    }
    // The browser only sends the id. The data itself comes fresh from OpenAlex,
    // so nobody can save made-up paper data.
    const paper = await openAlex.getWork(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'OpenAlex does not know this paper.' });
    }
    db.savePaper(paper); // stored once, shared by everyone who saves this paper
    const entry = db.addEntry(req.user.id, paperId);
    if (!entry) {
      return res.status(409).json({ error: 'This paper is already on your reading list.' });
    }
    res.status(201).json({ ...db.findPaper(paperId), addedAt: entry.addedAt });
  });

  // DELETE /api/reading-list/W2741809807  ->  remove a paper from this user's list
  router.delete('/:paperId', (req, res) => {
    const removed = db.removeEntry(req.user.id, req.params.paperId.toUpperCase());
    if (!removed) {
      return res.status(404).json({ error: 'This paper is not on your reading list.' });
    }
    res.status(204).end(); // 204 = done, nothing to send back
  });

  return router;
}
