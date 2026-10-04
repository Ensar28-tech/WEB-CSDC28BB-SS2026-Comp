// Feature 3 – Refresh saved papers (admins only).
import { api, formatDateTime, getUser, paperTable, renderNav, showMessage } from './common.js';

renderNav();
const refreshButton = document.querySelector('#refresh-button');
const changesList = document.querySelector('#changes');
const papersBox = document.querySelector('#papers');

if (getUser()?.role === 'admin') {
  refreshButton.addEventListener('click', refreshAll);
  loadPapers();
} else {
  refreshButton.hidden = true;
  showMessage('This page is only for administrators.', 'error');
}

async function loadPapers() {
  try {
    const papers = await api('GET', '/api/admin/papers');
    papersBox.replaceChildren(paperTable(papers, {
      extraColumns: [
        { title: 'Saved by', value: (paper) => `${paper.savedBy} user${paper.savedBy === 1 ? '' : 's'}` },
        { title: 'Last fetched', value: (paper) => formatDateTime(paper.fetchedAt) },
      ],
    }));
    if (papers.length === 0) showMessage('No user has saved a paper yet.');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function refreshAll() {
  refreshButton.disabled = true;
  changesList.replaceChildren();
  showMessage('Fetching every saved paper from OpenAlex…');
  try {
    const result = await api('POST', '/api/admin/papers/refresh');
    const papers = `${result.checked} paper${result.checked === 1 ? '' : 's'}`;
    const summary = `Checked ${papers}: ${result.changes.length} changed, ${result.failed.length} failed.`;
    showMessage(summary, result.failed.length > 0 ? 'error' : 'success');
    for (const change of result.changes) {
      const item = document.createElement('li');
      item.textContent = `${change.title} (${change.id}): ${change.fields.join(', ')} changed`;
      changesList.append(item);
    }
    if (result.failed.length > 0) {
      const item = document.createElement('li');
      item.textContent = `Could not refresh: ${result.failed.join(', ')} (the old data was kept)`;
      changesList.append(item);
    }
    await loadPapers();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    refreshButton.disabled = false;
  }
}
