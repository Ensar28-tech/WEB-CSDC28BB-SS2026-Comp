// A very small database: all data lives in memory and is written to one JSON file
// (data/db.json) after every change, so it survives a restart.
//
// It holds three collections ("tables"):
//   users               { id, username, passwordHash, role, createdAt }
//   papers              { the 8 paper properties, fetchedAt }  one per OpenAlex work, shared by all users
//   readingListEntries  { id, userId, paperId, addedAt }       "this user saved this paper"
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class Database {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { users: [], papers: [], readingListEntries: [] };
    if (fs.existsSync(filePath)) {
      this.data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // In the file the date is text again, so turn it back into a Date (see paper.js).
      for (const paper of this.data.papers) {
        paper.publicationDate = paper.publicationDate ? new Date(paper.publicationDate) : null;
      }
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    // Write a temporary file first, then rename it: a crash halfway through
    // writing can then never leave a broken db.json behind.
    const tempFile = `${this.filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2));
    fs.renameSync(tempFile, this.filePath);
  }

  // ---------- users ----------

  findUserById(id) {
    return this.data.users.find((user) => user.id === id);
  }

  // Usernames are compared without case, so "Alice" and "alice" are the same user.
  findUserByUsername(username) {
    const wanted = username.toLowerCase();
    return this.data.users.find((user) => user.username.toLowerCase() === wanted);
  }

  hasAdmin() {
    return this.data.users.some((user) => user.role === 'admin');
  }

  // Returns the new user, or null when the username is already taken.
  // The check and the insert happen together, so two requests can't both take the same name.
  createUser(username, passwordHash, role) {
    if (this.findUserByUsername(username)) return null;
    const user = {
      id: crypto.randomUUID(),
      username,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  // ---------- papers ----------

  findPaper(id) {
    return this.data.papers.find((paper) => paper.id === id);
  }

  listPapers() {
    return this.data.papers;
  }

  // Inserts the paper, or replaces the stored copy when there already is one.
  savePaper(paper) {
    const stored = { ...paper, fetchedAt: new Date().toISOString() };
    const index = this.data.papers.findIndex((p) => p.id === paper.id);
    if (index === -1) {
      this.data.papers.push(stored);
    } else {
      this.data.papers[index] = stored;
    }
    this.save();
    return stored;
  }

  // ---------- reading list entries ----------

  findEntry(userId, paperId) {
    return this.data.readingListEntries.find(
      (entry) => entry.userId === userId && entry.paperId === paperId,
    );
  }

  // Returns the new entry, or null when the user has already saved this paper.
  addEntry(userId, paperId) {
    if (this.findEntry(userId, paperId)) return null;
    const entry = {
      id: crypto.randomUUID(),
      userId,
      paperId,
      addedAt: new Date().toISOString(),
    };
    this.data.readingListEntries.push(entry);
    this.save();
    return entry;
  }

  // Returns false when there was nothing to remove.
  removeEntry(userId, paperId) {
    const entry = this.findEntry(userId, paperId);
    if (!entry) return false;
    this.data.readingListEntries = this.data.readingListEntries.filter((e) => e !== entry);
    // A paper is only kept while at least one reading list still contains it.
    if (this.countSaves(paperId) === 0) {
      this.data.papers = this.data.papers.filter((paper) => paper.id !== paperId);
    }
    this.save();
    return true;
  }

  // How many users have this paper on their reading list.
  countSaves(paperId) {
    return this.data.readingListEntries.filter((entry) => entry.paperId === paperId).length;
  }

  // One user's reading list: each saved paper with the time it was added, newest first.
  readingListOf(userId) {
    return this.data.readingListEntries
      .filter((entry) => entry.userId === userId)
      .map((entry) => ({ ...this.findPaper(entry.paperId), addedAt: entry.addedAt }))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
}
