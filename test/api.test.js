// Tests for the REST API. They start the real Express app with a temporary database
// and a fake OpenAlex, then send real HTTP requests to it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { Database } from '../src/db.js';
import { OpenAlexError } from '../src/openalex.js';

// The fake OpenAlex answers from this list instead of the internet, so the tests
// are fast and give the same result every time.
const works = {
  W1: {
    id: 'W1',
    title: 'First paper',
    type: 'article',
    publicationYear: 2020,
    publicationDate: new Date('2020-05-17T00:00:00Z'),
    citedByCount: 10,
    hasFulltext: true,
    isRetracted: false,
  },
  W2: {
    id: 'W2',
    title: 'Second paper',
    type: 'preprint',
    publicationYear: 2023,
    publicationDate: new Date('2023-01-09T00:00:00Z'),
    citedByCount: 3,
    hasFulltext: false,
    isRetracted: true,
  },
};

const fakeOpenAlex = {
  isDown: false,
  async searchWorks() {
    if (this.isDown) throw new OpenAlexError('down');
    return { total: 2, papers: Object.values(works) };
  },
  async getWork(id) {
    if (this.isDown) throw new OpenAlexError('down');
    return works[id] ? { ...works[id] } : null;
  },
};

let server;
let baseUrl;
let db;
let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reading-list-test-'));
  db = new Database(path.join(dataDir, 'db.json'));
  db.createUser('boss', await bcrypt.hash('boss-password', 4), 'admin');
  server = createApp({ db, openAlex: fakeOpenAlex }).listen(0); // 0 = any free port
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// Sends one request to the app and returns { status, body }.
async function call(method, url, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(baseUrl + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function registerUser(username) {
  const response = await call('POST', '/api/auth/register', { body: { username, password: 'password123' } });
  assert.equal(response.status, 201);
  return response.body.token;
}

async function loginAdmin() {
  const response = await call('POST', '/api/auth/login', { body: { username: 'boss', password: 'boss-password' } });
  assert.equal(response.status, 200);
  return response.body.token;
}

test('guests can search, and the date travels as ISO text', async () => {
  const response = await call('GET', '/api/papers/search?q=paper');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.papers[0].publicationDate, '2020-05-17T00:00:00.000Z');
});

test('a search needs a search term', async () => {
  assert.equal((await call('GET', '/api/papers/search')).status, 400);
  assert.equal((await call('GET', '/api/papers/search?q=%20%20')).status, 400);
});

test('the reading list needs a login', async () => {
  assert.equal((await call('GET', '/api/reading-list')).status, 401);
  assert.equal((await call('GET', '/api/reading-list', { token: 'not-a-real-token' })).status, 401);
  assert.equal((await call('POST', '/api/reading-list', { body: { paperId: 'W1' } })).status, 401);
});

test('registration creates a normal user, and a name can only be taken once', async () => {
  const first = await call('POST', '/api/auth/register', { body: { username: 'alice', password: 'password123' } });
  assert.equal(first.status, 201);
  assert.equal(first.body.user.role, 'user');
  assert.ok(first.body.token);
  assert.equal(first.body.user.passwordHash, undefined, 'the hash must never leave the server');

  const again = await call('POST', '/api/auth/register', { body: { username: 'ALICE', password: 'password123' } });
  assert.equal(again.status, 409);

  const shortPassword = await call('POST', '/api/auth/register', { body: { username: 'bob', password: 'short' } });
  assert.equal(shortPassword.status, 400);

  const stored = db.findUserByUsername('alice');
  assert.notEqual(stored.passwordHash, 'password123', 'the password is stored as a hash');
});

test('login checks the password', async () => {
  await registerUser('bruno');

  const wrong = await call('POST', '/api/auth/login', { body: { username: 'bruno', password: 'wrong-password' } });
  assert.equal(wrong.status, 401);
  const unknown = await call('POST', '/api/auth/login', { body: { username: 'nobody', password: 'password123' } });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error, wrong.body.error, 'both failures look the same');

  const right = await call('POST', '/api/auth/login', { body: { username: 'bruno', password: 'password123' } });
  assert.equal(right.status, 200);
  assert.ok(right.body.token);
});

test('a user saves, lists and removes papers', async () => {
  const token = await registerUser('carla');

  const saved = await call('POST', '/api/reading-list', { token, body: { paperId: 'w1' } });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.id, 'W1');
  assert.equal((await call('POST', '/api/reading-list', { token, body: { paperId: 'W1' } })).status, 409);
  assert.equal((await call('POST', '/api/reading-list', { token, body: { paperId: 'W999' } })).status, 404);
  assert.equal((await call('POST', '/api/reading-list', { token, body: { paperId: 'hello' } })).status, 400);

  const list = await call('GET', '/api/reading-list', { token });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((paper) => paper.id), ['W1']);
  assert.equal(list.body[0].title, 'First paper');
  assert.ok(list.body[0].addedAt);

  assert.equal((await call('DELETE', '/api/reading-list/W1', { token })).status, 204);
  assert.deepEqual((await call('GET', '/api/reading-list', { token })).body, []);
  assert.equal((await call('DELETE', '/api/reading-list/W1', { token })).status, 404);
});

test('users only see their own reading list', async () => {
  const dora = await registerUser('dora');
  const emil = await registerUser('emil');
  await call('POST', '/api/reading-list', { token: dora, body: { paperId: 'W1' } });

  assert.deepEqual((await call('GET', '/api/reading-list', { token: emil })).body, []);
  assert.equal((await call('DELETE', '/api/reading-list/W1', { token: emil })).status, 404);
  assert.equal((await call('GET', '/api/reading-list', { token: dora })).body.length, 1);
});

test('a paper saved by two users is stored once, and deleted with its last entry', async () => {
  const fritz = await registerUser('fritz');
  const greta = await registerUser('greta');
  await call('POST', '/api/reading-list', { token: fritz, body: { paperId: 'W2' } });
  await call('POST', '/api/reading-list', { token: greta, body: { paperId: 'W2' } });

  assert.equal(db.listPapers().filter((paper) => paper.id === 'W2').length, 1);
  assert.equal(db.countSaves('W2'), 2);

  await call('DELETE', '/api/reading-list/W2', { token: fritz });
  assert.ok(db.findPaper('W2'), 'greta still has it');
  await call('DELETE', '/api/reading-list/W2', { token: greta });
  assert.equal(db.findPaper('W2'), undefined, 'nobody has it any more');
});

test('only admins can see and refresh all saved papers', async () => {
  const token = await registerUser('hugo');

  assert.equal((await call('GET', '/api/admin/papers')).status, 401);
  assert.equal((await call('POST', '/api/admin/papers/refresh')).status, 401);
  assert.equal((await call('GET', '/api/admin/papers', { token })).status, 403);
  assert.equal((await call('POST', '/api/admin/papers/refresh', { token })).status, 403);
});

test('a refresh updates the one stored copy, so every reading list shows the new data', async () => {
  const ida = await registerUser('ida');
  const jan = await registerUser('jan');
  await call('POST', '/api/reading-list', { token: ida, body: { paperId: 'W2' } });
  await call('POST', '/api/reading-list', { token: jan, body: { paperId: 'W2' } });
  works.W2.citedByCount = 99; // OpenAlex now reports more citations

  const admin = await loginAdmin();
  const refresh = await call('POST', '/api/admin/papers/refresh', { token: admin });

  assert.equal(refresh.status, 200);
  assert.deepEqual(refresh.body.failed, []);
  assert.deepEqual(refresh.body.changes, [{ id: 'W2', title: 'Second paper', fields: ['citedByCount'] }]);
  assert.equal((await call('GET', '/api/reading-list', { token: ida })).body[0].citedByCount, 99);
  assert.equal((await call('GET', '/api/reading-list', { token: jan })).body[0].citedByCount, 99);

  const overview = await call('GET', '/api/admin/papers', { token: admin });
  assert.equal(overview.body.find((paper) => paper.id === 'W2').savedBy, 2);
});

test('when OpenAlex is down the API answers 502, and a refresh reports the failures', async () => {
  const admin = await loginAdmin();
  fakeOpenAlex.isDown = true;
  try {
    assert.equal((await call('GET', '/api/papers/search?q=paper')).status, 502);
    const refresh = await call('POST', '/api/admin/papers/refresh', { token: admin });
    assert.equal(refresh.status, 200);
    assert.ok(refresh.body.checked > 0);
    assert.equal(refresh.body.failed.length, refresh.body.checked);
  } finally {
    fakeOpenAlex.isDown = false;
  }
});

test('the data survives a restart, with the publication date as a Date again', () => {
  const reopened = new Database(db.filePath);

  assert.ok(reopened.findUserByUsername('alice'));
  const paper = reopened.findPaper('W1');
  assert.ok(paper.publicationDate instanceof Date);
  assert.equal(paper.publicationDate.toISOString(), '2020-05-17T00:00:00.000Z');
});
