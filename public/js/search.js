// Feature 1 – Search papers (everyone). Logged-in users also get a "Save" button per paper.
import { api, getUser, makeButton, paperTable, renderNav, showMessage } from './common.js';

renderNav();

const form = document.querySelector('#search-form');
const input = document.querySelector('#query');
const results = document.querySelector('#results');
document.querySelector('#guest-hint').hidden = getUser() !== null;

form.addEventListener('submit', async (event) => {
  event.preventDefault(); // stay on this page: the results are fetched in the background
  results.replaceChildren();
  showMessage('Searching…');
  try {
    const query = encodeURIComponent(input.value);
    const { total, papers } = await api('GET', `/api/papers/search?q=${query}`);
    const savedIds = await loadSavedIds();
    showMessage(`${total.toLocaleString('en-GB')} papers found, showing the first ${papers.length}.`);
    const actionButton = getUser() ? (paper) => saveButton(paper, savedIds) : undefined;
    results.append(paperTable(papers, { actionButton }));
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

// The ids already on the user's reading list, so those show "Saved" instead of "Save".
async function loadSavedIds() {
  if (!getUser()) return new Set();
  const list = await api('GET', '/api/reading-list');
  return new Set(list.map((paper) => paper.id));
}

function saveButton(paper, savedIds) {
  const button = makeButton('Save', async () => {
    button.disabled = true;
    try {
      await api('POST', '/api/reading-list', { paperId: paper.id });
      button.textContent = 'Saved';
      showMessage(`"${paper.title}" is now on your reading list.`, 'success');
    } catch (error) {
      button.disabled = false;
      showMessage(error.message, 'error');
    }
  });
  if (savedIds.has(paper.id)) {
    button.textContent = 'Saved';
    button.disabled = true;
  }
  return button;
}

// A link like index.html?q=climate starts that search right away.
const startQuery = new URLSearchParams(location.search).get('q');
if (startQuery) {
  input.value = startQuery;
  form.requestSubmit();
}
