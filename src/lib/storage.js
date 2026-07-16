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

function normalizeNote(note) {
  if (!note || typeof note !== "object") {
    throw new Error("note 数据为空或格式错误");
  }

  const cleanNote = {
    id: requireString(note.id, "id"),
    text: requireString(note.text, "text"),
    comment: requireString(note.comment, "comment"),
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
    throw new Error(`note.${fieldName} 不能为空`);
  }

  return text;
}

function requireIsoString(value) {
  const ts = requireString(value, "ts");

  if (Number.isNaN(Date.parse(ts))) {
    throw new Error("note.ts 不是有效时间");
  }

  return ts;
}

function requireDateKey(value) {
  const dateKey = requireString(value, "dateKey");

  if (!/^\d{6}$/.test(dateKey)) {
    throw new Error("note.dateKey 必须是 YYMMDD");
  }

  return dateKey;
}
