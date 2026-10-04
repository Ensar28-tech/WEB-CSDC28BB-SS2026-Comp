// Helpers shared by every page: the login state, talking to our REST API,
// the menu, and the table that shows papers.

// ---------- login state ----------
// After a login the server sends a token. We keep it, and the user, in localStorage,
// so the user stays logged in while moving between pages.

export function getUser() {
  const text = localStorage.getItem('user');
  return text ? JSON.parse(text) : null;
}

export function saveLogin(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// ---------- talking to the server ----------
// Sends one request to our REST API and returns the JSON answer.
// When the answer is an error, it throws an Error with the server's message.
export async function api(method, url, body) {
  const options = { method, headers: {} };
  const token = localStorage.getItem('token');
  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (response.status === 401 && token) {
    logout(); // the token has expired: forget it
  }
  if (response.status === 204) {
    return null; // "No Content": it worked, and there is nothing to read
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `The request failed (${response.status}).`);
  }
  return data;
}

// ---------- the menu at the top of every page ----------
// Shows only the links this user may use. That is only for convenience:
// the server checks every request itself (see src/auth.js).
export function renderNav() {
  const user = getUser();
  const nav = document.querySelector('#nav');

  const brand = document.createElement('span');
  brand.className = 'brand';
  brand.textContent = 'Paper Reading List';
  nav.append(brand, link('index.html', 'Search'));
  if (user) nav.append(link('reading-list.html', 'My reading list'));
  if (user?.role === 'admin') nav.append(link('admin.html', 'Admin'));

  const account = document.createElement('span');
  account.className = 'account';
  if (user) {
    account.append(`${user.username} (${user.role}) `);
    account.append(makeButton('Log out', () => {
      logout();
      location.href = 'index.html';
    }));
  } else {
    account.append(link('login.html', 'Log in / Register'));
  }
  nav.append(account);
}

function link(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  if (currentPage === href) a.className = 'active';
  return a;
}

// ---------- small building blocks ----------

export function makeButton(text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

// Shows a line of text in the page's <p id="message">. kind: 'info', 'success' or 'error'.
export function showMessage(text, kind = 'info') {
  const box = document.querySelector('#message');
  box.textContent = text;
  box.className = `message ${kind}`;
}

// The server sends dates as text, because JSON has no date type. new Date() turns
// the text back into a Date. timeZone 'UTC' stops 13 Feb from showing as 12 Feb
// in time zones behind UTC (the date is stored as midnight UTC).
export function formatDate(text) {
  if (!text) return '–';
  return new Date(text).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// For moments in time (added, last fetched): shown in the viewer's own time zone.
export function formatDateTime(text) {
  return new Date(text).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

// ---------- the paper table ----------
// Builds a <table> that shows the eight paper properties, one paper per row.
//   extraColumns: more columns, e.g. [{ title: 'Added', value: (paper) => '...' }]
//   actionButton: optional, (paper) => a button for the last column
// Every value is set with textContent, never innerHTML, so a title that contains
// HTML is shown as text and can't run code in the page.
export function paperTable(papers, { extraColumns = [], actionButton } = {}) {
  const table = document.createElement('table');
  const headings = ['Title', 'Type', 'Year', 'Published', 'Cited by', 'Full text', 'Retracted', 'OpenAlex ID'];
  for (const column of extraColumns) headings.push(column.title);
  if (actionButton) headings.push('');

  const headRow = table.createTHead().insertRow();
  for (const heading of headings) {
    const th = document.createElement('th');
    th.textContent = heading;
    headRow.append(th);
  }

  const body = table.createTBody();
  for (const paper of papers) {
    const row = body.insertRow();
    if (paper.isRetracted) row.className = 'retracted';

    const titleLink = document.createElement('a');
    titleLink.href = `https://openalex.org/${paper.id}`;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener';
    titleLink.textContent = paper.title || '(no title)';
    row.insertCell().append(titleLink);

    addCell(row, paper.type);
    addCell(row, paper.publicationYear ?? '–');
    addCell(row, formatDate(paper.publicationDate));
    addCell(row, paper.citedByCount.toLocaleString('en-GB'));
    addCell(row, paper.hasFulltext ? 'yes' : 'no');
    addCell(row, paper.isRetracted ? 'RETRACTED' : 'no');
    addCell(row, paper.id);
    for (const column of extraColumns) addCell(row, column.value(paper));
    if (actionButton) row.insertCell().append(actionButton(paper));
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrap'; // lets a wide table scroll sideways on a phone
  wrapper.append(table);
  return wrapper;
}

function addCell(row, value) {
  row.insertCell().textContent = String(value);
}
