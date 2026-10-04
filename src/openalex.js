// Talks to the external OpenAlex REST API (https://api.openalex.org).
// Every request is asynchronous: while the server waits for OpenAlex, it keeps
// answering other requests.
import { config } from './config.js';
import { paperFromWork } from './paper.js';

const BASE_URL = 'https://api.openalex.org';
// Ask only for the eight fields we use ("select"), which keeps the answers small.
const FIELDS = 'id,title,type,publication_year,publication_date,cited_by_count,has_fulltext,is_retracted';
const RESULTS_PER_SEARCH = 25;

// Thrown when OpenAlex can't be reached or answers with an error; app.js turns it into a 502.
export class OpenAlexError extends Error {}

// Feature 1: search works by a search term.
export async function searchWorks(query) {
  const body = await get('/works', { search: query, 'per-page': RESULTS_PER_SEARCH, select: FIELDS });
  return { total: body.meta.count, papers: body.results.map(paperFromWork) };
}

// Features 2 and 3: the current data of one work, or null when OpenAlex doesn't know the id.
export async function getWork(id) {
  const body = await get(`/works/${id}`, { select: FIELDS });
  return body === null ? null : paperFromWork(body);
}

// Sends one GET request and returns the parsed JSON answer, or null for "404 Not Found".
async function get(path, params) {
  const url = new URL(path, BASE_URL);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  // Optional: a free OpenAlex key raises the daily limit. The app works without one.
  if (config.openAlexApiKey) {
    url.searchParams.set('api_key', config.openAlexApiKey);
  }

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) }); // give up after 10 s
  } catch (error) {
    throw new OpenAlexError(`OpenAlex could not be reached (${error.message})`);
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new OpenAlexError(`OpenAlex answered with status ${response.status}`);
  }
  return response.json();
}
