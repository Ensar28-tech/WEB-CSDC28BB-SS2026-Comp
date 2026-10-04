// Feature 3 – Refresh saved papers. Admins only: requireLogin first, then requireAdmin.
import express from 'express';
import { requireAdmin, requireLogin } from '../auth.js';
import { OpenAlexError } from '../openalex.js';
import { changedFields } from '../paper.js';

export function createAdminRouter(db, openAlex) {
  const router = express.Router();
  router.use(requireLogin(db), requireAdmin); // guards every route below

  // GET /api/admin/papers  ->  every stored paper, with how many users saved it
  router.get('/papers', (req, res) => {
    const papers = db.listPapers().map((paper) => ({ ...paper, savedBy: db.countSaves(paper.id) }));
    res.json(papers);
  });

  // POST /api/admin/papers/refresh  ->  fetch EVERY stored paper again from OpenAlex.
  // A paper is stored once for all users, so this updates every reading list at once.
  router.post('/papers/refresh', async (req, res) => {
    const ids = db.listPapers().map((paper) => paper.id);
    const changes = [];
    const failed = [];
    // One request after the other, not all at once, to stay within OpenAlex's rate limit.
    for (const id of ids) {
      try {
        const fresh = await openAlex.getWork(id);
        // A user may have removed the paper while we waited; then it stays removed.
        const stored = db.findPaper(id);
        if (!stored) continue;
        if (!fresh) {
          failed.push(id); // OpenAlex no longer knows it: keep our copy
          continue;
        }
        const fields = changedFields(stored, fresh);
        db.savePaper(fresh);
        if (fields.length > 0) {
          changes.push({ id, title: fresh.title, fields });
        }
      } catch (error) {
        if (!(error instanceof OpenAlexError)) throw error; // a bug, not a network problem
        failed.push(id); // OpenAlex not reachable for this one: keep our copy, go on
      }
    }
    res.json({ checked: ids.length, changes, failed });
  });

  return router;
}
