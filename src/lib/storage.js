import { getMessage as t } from "./i18n.js";

export const NOTES_KEY = "h2c_notes";
export const WRITTEN_NOTE_IDS_KEY = "h2c_written_note_ids";
export const LOG_SNAPSHOTS_KEY = "h2c_log_snapshots";
export const IGNORED_NOTE_IDS_KEY = "h2c_ignored_note_ids";
export const MISSING_NOTE_IDS_KEY = "h2c_missing_note_ids";

export async function saveNote(note) {
  const cleanNote = normalizeNote(note);
  const notes = await getNotes();
  const nextNotes = [...notes, cleanNote];

  await chrome.storage.local.set({ [NOTES_KEY]: nextNotes });
  return cleanNote;
}

export async function getNotes() {
  const data = await chrome.storage.local.get({ [NOTES_KEY]: [] });
  return Array.isArray(data[NOTES_KEY]) ? data[NOTES_KEY] : [];
}

export async function getNoteCount() {
  const notes = await getNotes();
  return notes.length;
}

export async function findRecentDuplicate(note, windowMs) {
  const candidate = normalizeNote(note);
  const notes = await getNotes();
  const now = Date.now();
  const recentWindowMs = Math.max(0, Number(windowMs) || 0);

  return (
    notes.find(
      (existingNote) =>
        isWithinWindow(existingNote.ts, now, recentWindowMs) &&
        hasSameSavedContent(existingNote, candidate),
    ) || null
  );
}

export async function getWrittenNoteIds() {
  const data = await chrome.storage.local.get({ [WRITTEN_NOTE_IDS_KEY]: [] });
  const ids = data[WRITTEN_NOTE_IDS_KEY];
  return Array.isArray(ids) ? ids : [];
}

export async function getPendingNotes() {
  const [notes, writtenIds] = await Promise.all([getNotes(), getWrittenNoteIds()]);
  const writtenIdSet = new Set(writtenIds);
  return notes.filter((note) => !writtenIdSet.has(note.id));
}

export async function getPendingCount() {
  const pendingNotes = await getPendingNotes();
  return pendingNotes.length;
}

export async function markNotesWritten(noteIds) {
  const currentIds = await getWrittenNoteIds();
  const nextIds = new Set(currentIds);

  for (const noteId of noteIds) {
    nextIds.add(noteId);
  }

  await chrome.storage.local.set({
    [WRITTEN_NOTE_IDS_KEY]: Array.from(nextIds),
  });
}

export async function saveLogSnapshot(text) {
  const data = await chrome.storage.local.get({ [LOG_SNAPSHOTS_KEY]: [] });
  const snapshots = Array.isArray(data[LOG_SNAPSHOTS_KEY])
    ? data[LOG_SNAPSHOTS_KEY]
    : [];
  const nextSnapshots = [{ ts: Date.now(), text }, ...snapshots].slice(0, 2);

  await chrome.storage.local.set({ [LOG_SNAPSHOTS_KEY]: nextSnapshots });
}

export async function getIgnoredNoteIds() {
  const data = await chrome.storage.local.get({ [IGNORED_NOTE_IDS_KEY]: [] });
  const ids = data[IGNORED_NOTE_IDS_KEY];
  return Array.isArray(ids) ? Array.from(new Set(ids)) : [];
}

export async function addIgnoredNoteIds(noteIds) {
  const currentIds = await getIgnoredNoteIds();
  const nextIds = new Set(currentIds);

  for (const noteId of noteIds) {
    nextIds.add(noteId);
  }

  await chrome.storage.local.set({
    [IGNORED_NOTE_IDS_KEY]: Array.from(nextIds),
  });
}

export async function getMissingNoteIds() {
  const data = await chrome.storage.local.get({ [MISSING_NOTE_IDS_KEY]: [] });
  const ids = data[MISSING_NOTE_IDS_KEY];
  return Array.isArray(ids) ? Array.from(new Set(ids)) : [];
}

export async function setMissingNoteIds(noteIds) {
  await chrome.storage.local.set({
    [MISSING_NOTE_IDS_KEY]: Array.from(new Set(noteIds)),
  });
}

export async function unmarkNotesWritten(noteIds) {
  const currentIds = await getWrittenNoteIds();
  const idsToRemove = new Set(noteIds);
  const nextIds = currentIds.filter((noteId) => !idsToRemove.has(noteId));

  await chrome.storage.local.set({
    [WRITTEN_NOTE_IDS_KEY]: Array.from(new Set(nextIds)),
  });
}

export async function deleteNote(id) {
  const noteId = String(id || "");
  const [notes, writtenIds] = await Promise.all([getNotes(), getWrittenNoteIds()]);
  const nextNotes = notes.filter((note) => note.id !== noteId);
  const nextWrittenIds = writtenIds.filter((writtenId) => writtenId !== noteId);

  await chrome.storage.local.set({
    [NOTES_KEY]: nextNotes,
    [WRITTEN_NOTE_IDS_KEY]: nextWrittenIds,
  });
  return nextNotes.length !== notes.length;
}

function isWithinWindow(timestamp, now, windowMs) {
  const savedAt = Date.parse(timestamp);
  const age = now - savedAt;
  return Number.isFinite(savedAt) && age >= 0 && age <= windowMs;
}

function hasSameSavedContent(left, right) {
  return left.url === right.url && left.text === right.text && left.comment === right.comment;
}

function normalizeNote(note) {
  if (!note || typeof note !== "object") {
    throw new Error(t("invalidNoteError"));
  }

  const cleanNote = {
    id: requireString(note.id, "id"),
    text: requireString(note.text, "text"),
    comment: String(note.comment || "").trim(),
    url: requireString(note.url, "url"),
    title: String(note.title || ""),
    author: String(note.author || ""),
    ts: requireIsoString(note.ts),
    dateKey: requireDateKey(note.dateKey),
  };

  return cleanNote;
}

function requireString(value, fieldName) {
  const text = String(value || "").trim();

  if (!text) {
    throw new Error(t("requiredNoteFieldError", [fieldName]));
  }

  return text;
}

function requireIsoString(value) {
  const ts = requireString(value, "ts");

  if (Number.isNaN(Date.parse(ts))) {
    throw new Error(t("invalidNoteTimestampError"));
  }

  return ts;
}

function requireDateKey(value) {
  const dateKey = requireString(value, "dateKey");

  if (!/^\d{6}$/.test(dateKey)) {
    throw new Error(t("invalidNoteDateKeyError"));
  }

  return dateKey;
}
