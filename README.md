# Paper Reading List

A web app for searching scientific papers through the [OpenAlex API](https://docs.openalex.org)
and keeping a personal reading list. Built with Node.js, Express and plain HTML, CSS and
JavaScript.

| Role | Can |
| --- | --- |
| Guest | search papers |
| User | also save papers to a personal reading list and remove them |
| Admin | also refresh all saved papers with the current data from OpenAlex |

## Requirements

- [Node.js](https://nodejs.org) 22 or newer (tested with 24.19.0), npm comes with it
- Internet access, to reach OpenAlex

`npm install` installs express 5.2.1, bcryptjs 3.0.3 and jsonwebtoken 9.0.3.
No database server is needed: the data is stored in `data/db.json`.

## Installation and start

```bash
git clone https://github.com/Ensar28-tech/WEB-CSDC28BB-SS2026-Comp.git
cd WEB-CSDC28BB-SS2026-Comp
npm install
npm start
```

Open <http://localhost:3000>. The server delivers both the web pages and the REST API, and
there is no build step. Stop it with Ctrl+C.

- Admin login: `admin` / `admin1234` (created on the first start).
- Accounts created with "Register" are normal users.
- On Windows, if PowerShell says "running scripts is disabled", use `npm.cmd install` and
  `npm.cmd start`, or the Command Prompt.

Tests: `npm test` (no internet needed).

## Configuration (optional)

The app runs without configuration. To change a setting, copy `.env.example` to `.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | server port |
| `JWT_SECRET` | a development secret | signs the login tokens |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `admin`, `admin1234` | admin account created on the first start |
| `DATA_FILE` | `data/db.json` | where the data is stored |
| `OPENALEX_API_KEY` | empty | optional OpenAlex key |

OpenAlex needs no API key. Without one, about 100 searches per day are free; a free key from
<https://openalex.org/settings/api> raises that 10×.

## REST API

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | everyone |
| GET | `/api/papers/search?q=term` | everyone |
| GET, POST | `/api/reading-list` | User, Admin |
| DELETE | `/api/reading-list/:paperId` | User, Admin |
| GET | `/api/admin/papers` | Admin |
| POST | `/api/admin/papers/refresh` | Admin |

Protected routes need the header `Authorization: Bearer <token>`; register and login return
the token. The data model, login and features are described in [docs/concept.md](docs/concept.md).
