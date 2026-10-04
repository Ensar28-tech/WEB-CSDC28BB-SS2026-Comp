// The Paper resource: the eight properties from the approved concept, and the
// code that turns an OpenAlex "Work" into a Paper.

export const PAPER_FIELDS = [
  'id',
  'title',
  'type',
  'publicationYear',
  'publicationDate',
  'citedByCount',
  'hasFulltext',
  'isRetracted',
];

// OpenAlex work ids look like "W2741809807".
export function isWorkId(text) {
  return typeof text === 'string' && /^W\d+$/.test(text);
}

// Turns one OpenAlex Work (snake_case JSON) into our Paper object (camelCase).
export function paperFromWork(work) {
  return {
    id: work.id.replace('https://openalex.org/', ''), // OpenAlex sends the id as a full URL
    title: work.title ?? '',
    type: work.type ?? '',
    publicationYear: work.publication_year ?? null,
    publicationDate: parsePublicationDate(work.publication_date),
    citedByCount: work.cited_by_count ?? 0,
    hasFulltext: work.has_fulltext === true,
    isRetracted: work.is_retracted === true,
  };
}

// JSON has no date type, so OpenAlex sends the date as text ("2018-02-13").
// This turns the text into a real Date, or null when it is missing or not a real day.
export function parsePublicationDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  // Midnight UTC, so the day can't shift with the server's time zone.
  const date = new Date(`${text}T00:00:00Z`);
  // JavaScript quietly turns "2021-02-30" into 2 March: reject a day that changed while parsing.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
  return date;
}

// Names of the fields whose value differs between two versions of a paper (used by the refresh).
export function changedFields(before, after) {
  return PAPER_FIELDS.filter((field) => comparable(before[field]) !== comparable(after[field]));
}

// Two Date objects are never === each other, so dates are compared by their time value.
function comparable(value) {
  return value instanceof Date ? value.getTime() : value;
}
