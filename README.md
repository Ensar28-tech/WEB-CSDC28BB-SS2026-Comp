# Paper Reading List

A web application for searching scientific papers through the public
[OpenAlex REST API](https://docs.openalex.org) and keeping a personal reading list.

- **Guests** can search papers (Feature 1).
- **Users** can also save papers to their own reading list and remove them (Feature 2).
- **Admins** can also refresh every saved paper with the current data from OpenAlex (Feature 3).

Built with JavaScript, Node.js and Express (REST API) and a plain HTML/CSS/JavaScript
frontend that talks to the server asynchronously with `fetch`.

## Requirements

| Software | Version |
| --- | --- |
| [Node.js](https://nodejs.org) | 22 or newer (tested with 24.19.0) |
| npm | comes with Node.js (tested with 11.17.0) |
| Internet access | needed to reach `https://api.openalex.org` |

No database server is needed: the data is stored in a JSON file (see [Data storage](#data-storage)).

The npm packages (installed by `npm install`):

| Package | Version | Used for |
| --- | --- | --- |
| express | 5.2.1 | web server and REST API |
| bcryptjs | 3.0.3 | hashing passwords |
| jsonwebtoken | 9.0.3 | login tokens (JWT) |

## Installation

```bash
git clone https://github.com/Ensar28-tech/WEB-CSDC28BB-SS2026-Comp.git
cd WEB-CSDC28BB-SS2026-Comp
npm install
```

There is no build step: the server and the browser run the JavaScript files as they are.

## Configuration (optional)

The app runs without any configuration. To change a setting, copy `.env.example` to `.env`
and edit it:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | port of the web server |
| `JWT_SECRET` | `development-secret-change-me` | secret that signs login tokens; set your own outside of development |
| `ADMIN_USERNAME` | `admin` | name of the admin account created on the first start |
| `ADMIN_PASSWORD` | `admin1234` | password of that admin account |
| `DATA_FILE` | `data/db.json` | file that holds all data |
| `OPENALEX_API_KEY` | empty | optional, see below |

### OpenAlex API key

OpenAlex needs **no API key** for this app. Without a key OpenAlex grants a free daily
budget of about 100 searches; looking up single papers (saving, refreshing) costs
nothing. A free key from <https://openalex.org/settings/api> raises the budget 10x; put
it in `.env` as `OPENALEX_API_KEY`.

## Starting the application

```bash
npm start
```

Then open <http://localhost:3000> in a browser. The same server delivers both the web
pages (client) and the REST API, so there is nothing else to start. Stop it with Ctrl+C.

On Windows, PowerShell may refuse with "running scripts is disabled on this system".
Then run `npm.cmd start` instead (the same goes for `npm.cmd install` and `npm.cmd test`),
or use the Command Prompt (`cmd`).

On the first start the server creates the admin account:

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin1234` | Admin |

Normal accounts are created on the page "Log in / Register" and always get the role User.
The Admin role can't be obtained through registration.

`npm run dev` starts the server in watch mode (it restarts when a file changes).

## Running the tests

```bash
npm test
```

The tests use Node's built-in test runner. They start the app with a temporary data file
and a fake OpenAlex, so they need no internet access and don't touch `data/db.json`.

## How to use it

1. **Search (everyone):** type a search term on the start page, e.g. `open access`.
   The table shows the eight properties of each paper.
2. **Register and log in:** "Log in / Register" in the menu.
3. **Reading list (User, Admin):** after logging in, each search result has a **Save**
   button. "My reading list" shows the saved papers; **Remove** deletes one.
4. **Refresh (Admin only):** log in as `admin`, open "Admin" and click
   **Refresh all saved papers**. The page reports which papers changed.

## REST API

All answers are JSON. Routes marked User or Admin need the header
`Authorization: Bearer <token>`, where the token comes from register or login.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | everyone | create a User account, returns `{ token, user }` |
| POST | `/api/auth/login` | everyone | log in, returns `{ token, user }` |
| GET | `/api/papers/search?q=term` | everyone | Feature 1: search OpenAlex, returns `{ total, papers }` |
| GET | `/api/reading-list` | User, Admin | Feature 2: the caller's saved papers |
| POST | `/api/reading-list` | User, Admin | Feature 2: save a paper, body `{ "paperId": "W2741809807" }` |
| DELETE | `/api/reading-list/:paperId` | User, Admin | Feature 2: remove a paper from the caller's list |
| GET | `/api/admin/papers` | Admin | Feature 3: every stored paper and how many users saved it |
| POST | `/api/admin/papers/refresh` | Admin | Feature 3: fetch every stored paper again from OpenAlex |

Status codes: `400` invalid input, `401` not logged in or token expired, `403` not an
admin, `404` not found, `409` already exists, `502` OpenAlex not reachable.

## Resource: Paper

| Property | Type | OpenAlex field |
| --- | --- | --- |
| `id` | String | `id` (shortened to e.g. `W2741809807`) |
| `title` | String | `title` |
| `type` | String | `type` |
| `publicationYear` | Number | `publication_year` |
| `publicationDate` | Date | `publication_date` (text, parsed into a `Date`) |
| `citedByCount` | Number | `cited_by_count` |
| `hasFulltext` | Boolean | `has_fulltext` |
| `isRetracted` | Boolean | `is_retracted` |

## Data storage

Everything is stored in one JSON file (`data/db.json`, created on the first start) with
three collections:

- `users`: `id`, `username`, `passwordHash` (bcrypt, never the password), `role`
  (`user` or `admin`), `createdAt`
- `papers`: the eight properties plus `fetchedAt`. Each paper is stored **once**, no
  matter how many users saved it.
- `readingListEntries`: `id`, `userId`, `paperId`, `addedAt`. One entry links one user
  to one saved paper.

Delete `data/db.json` (with the server stopped) to start over with an empty app.
[docs/concept.md](docs/concept.md) explains the data model and the login in detail.

## Project structure

```
server.js                 starts the server, creates the admin account
src/
  app.js                  Express app: middleware, routes, error handler
  config.js               settings from environment variables / .env
  db.js                   the JSON-file database (users, papers, reading list entries)
  openalex.js             requests to the OpenAlex API
  paper.js                the Paper model: mapping, date parsing, comparing
  auth.js                 login tokens and the requireLogin / requireAdmin middleware
  routes/
    auth.js               register, login
    papers.js             Feature 1: search
    readingList.js        Feature 2: reading list
    admin.js              Feature 3: refresh
public/                   the web pages (HTML, CSS, browser JavaScript)
test/                     automated tests
docs/concept.md           the concept, with the clarifications the instructors asked for
```
