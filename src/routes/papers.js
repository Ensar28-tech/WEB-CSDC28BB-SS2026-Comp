// Feature 1 – Search papers. Open to everyone, guests too: there is no login check here.
import express from 'express';

export function createPapersRouter(openAlex) {
  const router = express.Router();

  // GET /api/papers/search?q=open+access
  router.get('/search', async (req, res) => {
    const query = String(req.query.q ?? '').trim();
    if (query === '' || query.length > 200) {
      return res.status(400).json({ error: 'Enter a search term (at most 200 characters).' });
    }
    const result = await openAlex.searchWorks(query);
    res.json(result); // { total, papers: [...] }
  });

  return router;
}
