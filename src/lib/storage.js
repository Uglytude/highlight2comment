import { getMessage as t } from "./i18n.js";

export const NOTES_KEY = "h2c_notes";
export const WRITTEN_NOTE_IDS_KEY = "h2c_written_note_ids";

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
