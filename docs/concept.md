# Concept: Paper Reading List

Ensar Gegic · Web Technologies ILV, compensational exercise, summer term 2026

This is the approved concept, with the clarifications the instructors asked for at
approval. Section 5 is new, and sections 2 and 4 gained detail on dates and the refresh.

## 1. External API

The application uses the [OpenAlex REST API](https://docs.openalex.org). OpenAlex provides
information about scientific works such as papers, articles and preprints. The Works
endpoint can search for works (`GET /works?search=...`) and retrieve a single work by its
OpenAlex ID (`GET /works/{id}`). The API was chosen because it is publicly accessible,
simple to use with REST requests, and its Work resource provides all data types required
for the project. No API key is needed; an optional free key raises the daily limit.

## 2. Resource: Scientific Paper (OpenAlex Work)

| Property | Type | Description |
| --- | --- | --- |
| `id` | String | Unique OpenAlex identifier of the paper, e.g. `W2741809807` |
| `title` | String | Title of the paper |
| `type` | String | Type of the work, e.g. article or preprint |
| `publicationYear` | Number | Year in which the paper was published |
| `publicationDate` | Date | Publication date of the paper |
| `citedByCount` | Number | Number of works that cite the paper |
| `hasFulltext` | Boolean | Whether downloadable full text is available |
| `isRetracted` | Boolean | Whether the paper is known to be retracted |

**How the date is handled.** JSON has no date type, so OpenAlex sends
`publication_date` as text (`"2018-02-13"`). The server parses it explicitly into a
JavaScript `Date` (midnight UTC, so the day can't shift with a time zone). Text that is
not a real calendar day (for example `"2021-02-30"`) becomes `null` instead of a wrong
date. Wherever the date travels as text again (in the data file, in the server's JSON
answers) it is written as ISO 8601 (`"2018-02-13T00:00:00.000Z"`) and parsed back into a
`Date` on arrival: by the server when it loads the data file, and by the browser before
it formats the date for display.

## 3. User roles and access control

| Role | Who | Features |
| --- | --- | --- |
| Guest | not logged in | Feature 1 |
| User | registered and logged in | Features 1 and 2 |
| Admin | logged in with the Admin role | Features 1, 2 and 3 (exclusive) |

Only Feature 1 is available without login. Registration always creates a User account.
The Admin account is created by the server on its first start from its configuration
(`ADMIN_USERNAME`, `ADMIN_PASSWORD`); the Admin role can't be obtained through
registration. Access is checked on the server for every request (section 5); the
browser only hides links a user can't use.

## 4. Feature set

**Feature 1 – Search Papers** (Guest, User, Admin)
Purpose: search for scientific papers and display their information.
External API: the server sends an asynchronous request to `GET /works` with the
`search` parameter and returns the eight properties of the first 25 results.

**Feature 2 – Manage Personal Reading List** (User, Admin)
Purpose: save selected papers to a personal reading list, view it, and remove papers.
External API: when a paper is saved, the server retrieves the current Work data from
OpenAlex by its ID (`GET /works/{id}`) and stores the eight properties locally (see
section 5 for how). Each user sees and changes only their own reading list.

**Feature 3 – Refresh Saved Papers** (Admin only)
Purpose: update the locally stored paper data with the current data from OpenAlex.
External API: the server retrieves the current Work data for each stored paper by its
OpenAlex ID and updates the stored properties.
Scope: one refresh updates **all saved papers globally**, every paper on at least one
reading list. Because each paper is stored only once (section 5), the new data appears
in every user's reading list at once. The papers are requested one after another to
respect the OpenAlex rate limit. A paper that can't be fetched keeps its old data and is
reported as failed; the admin sees which papers changed and in which properties.

## 5. Data model and storage

The application stores three kinds of records:

| Record | Fields | Purpose |
| --- | --- | --- |
| User | `id`, `username`, `passwordHash`, `role`, `createdAt` | an account |
| Paper | the eight properties, `fetchedAt` | the local copy of one OpenAlex work |
| ReadingListEntry | `id`, `userId`, `paperId`, `addedAt` | "this user saved this paper" |

**Paper data is stored once and linked to many users.** A Paper record exists once per
OpenAlex work, however many users saved it. The user-specific reading list is made of
ReadingListEntry records, each linking one user (`userId`) to one paper (`paperId`, the
OpenAlex ID). A user can save the same paper only once. When the last entry for a paper
is removed, the paper record is deleted too. This avoids duplicate copies that could
disagree, and it lets the admin refresh each paper with a single request.

**Persistence.** All records are kept in one JSON file on the server (`data/db.json`).
The server loads it on start and writes it after every change; it writes a temporary
file and renames it, so a crash can't leave a half-written file behind.

**Passwords.** Passwords are never stored. On registration the server hashes the
password with bcrypt (salted, cost factor 10) and stores only the hash; on login it
compares the entered password with the hash. Passwords need 8 to 72 characters.

**Sessions and tokens.** After a successful registration or login the server issues a
JSON Web Token (JWT), signed with a server secret (HS256), that contains the user's ID
and expires after 2 hours. The server keeps no session state. The browser keeps the
token in `localStorage` and sends it with every request in the header
`Authorization: Bearer <token>`. For each protected request the server verifies the
signature and expiry, then loads the user from the data file; the role used for access
decisions therefore always comes from the stored user record. Logging out deletes the
token in the browser.

**Authorization.** Two Express middleware functions guard the routes: `requireLogin`
(valid token, otherwise `401`) protects Features 2 and 3, and `requireAdmin` (role Admin,
otherwise `403`) also protects Feature 3. Reading list routes only ever read or change
entries whose `userId` is the logged-in user's.
