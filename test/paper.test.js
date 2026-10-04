// Tests for the Paper model: mapping an OpenAlex Work, parsing the date, finding changes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changedFields, isWorkId, paperFromWork, parsePublicationDate } from '../src/paper.js';

test('a Work from OpenAlex becomes a Paper with the eight properties', () => {
  // Exactly what OpenAlex answered for this work (fetched on 2026-10-04).
  const work = {
    id: 'https://openalex.org/W2741809807',
    title: 'The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles',
    type: 'article',
    publication_year: 2018,
    publication_date: '2018-02-13',
    cited_by_count: 1262,
    has_fulltext: false,
    is_retracted: false,
  };

  const paper = paperFromWork(work);

  assert.equal(paper.id, 'W2741809807');
  assert.equal(paper.title, work.title);
  assert.equal(paper.type, 'article');
  assert.equal(paper.publicationYear, 2018);
  assert.ok(paper.publicationDate instanceof Date);
  assert.equal(paper.publicationDate.toISOString(), '2018-02-13T00:00:00.000Z');
  assert.equal(paper.citedByCount, 1262);
  assert.equal(paper.hasFulltext, false);
  assert.equal(paper.isRetracted, false);
});

test('missing values get safe defaults', () => {
  const paper = paperFromWork({ id: 'https://openalex.org/W1' });

  assert.deepEqual(paper, {
    id: 'W1',
    title: '',
    type: '',
    publicationYear: null,
    publicationDate: null,
    citedByCount: 0,
    hasFulltext: false,
    isRetracted: false,
  });
});

test('the publication date is parsed into a Date, and only real days are accepted', () => {
  assert.equal(parsePublicationDate('2018-02-13').toISOString(), '2018-02-13T00:00:00.000Z');
  assert.equal(parsePublicationDate('2024-02-29').toISOString(), '2024-02-29T00:00:00.000Z'); // leap year
  assert.equal(parsePublicationDate('2021-02-30'), null); // no 30 February
  assert.equal(parsePublicationDate('2018'), null);
  assert.equal(parsePublicationDate(''), null);
  assert.equal(parsePublicationDate(null), null);
  assert.equal(parsePublicationDate(undefined), null);
});

test('work ids are recognised', () => {
  assert.equal(isWorkId('W2741809807'), true);
  assert.equal(isWorkId('A123'), false); // an author id, not a work
  assert.equal(isWorkId('W12; DROP'), false);
  assert.equal(isWorkId(42), false);
});

test('changedFields names the properties that differ, comparing dates by value', () => {
  const before = paperFromWork({ id: 'W1', title: 'A', cited_by_count: 1, publication_date: '2020-01-01' });
  const same = paperFromWork({ id: 'W1', title: 'A', cited_by_count: 1, publication_date: '2020-01-01' });
  const after = paperFromWork({ id: 'W1', title: 'A', cited_by_count: 5, publication_date: '2020-01-02' });

  assert.deepEqual(changedFields(before, same), []);
  assert.deepEqual(changedFields(before, after), ['publicationDate', 'citedByCount']);
});
