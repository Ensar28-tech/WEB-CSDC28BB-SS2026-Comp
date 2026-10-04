// Feature 2 – My reading list (logged-in users): shows the saved papers and removes them.
import { api, formatDateTime, getUser, makeButton, paperTable, renderNav, showMessage } from './common.js';

renderNav();
const list = document.querySelector('#list');

if (getUser()) {
  loadList();
} else {
  showMessage('Please log in to see your reading list.', 'error');
}

async function loadList() {
  try {
    const papers = await api('GET', '/api/reading-list');
    list.replaceChildren();
    if (papers.length === 0) {
      showMessage('Your reading list is empty. Save papers on the search page.');
      return;
    }
    showMessage(`${papers.length} saved paper${papers.length === 1 ? '' : 's'}.`);
    list.append(paperTable(papers, {
      extraColumns: [{ title: 'Added', value: (paper) => formatDateTime(paper.addedAt) }],
      actionButton: (paper) => makeButton('Remove', () => removePaper(paper)),
    }));
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function removePaper(paper) {
  try {
    await api('DELETE', `/api/reading-list/${paper.id}`);
    await loadList();
    showMessage(`Removed "${paper.title}" from your reading list.`, 'success');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}
