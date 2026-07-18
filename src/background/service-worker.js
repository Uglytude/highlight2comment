import { log } from "../lib/logger.js";
import { refreshBadge } from "../lib/badge.js";
import { saveNote } from "../lib/storage.js";

const SAVE_NOTE_MESSAGE = "H2C_SAVE_NOTE";

let saveQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(async () => {
  await log("extension_installed", {
    version: chrome.runtime.getManifest().version,
  });
  await refreshBadge("installed");
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshBadge("startup");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== SAVE_NOTE_MESSAGE) {
    return false;
  }

  saveQueue = saveQueue.then(
    () => handleSaveNote(message.note, sender),
    () => handleSaveNote(message.note, sender),
  );

  saveQueue.then(sendResponse);
  return true;
});

async function handleSaveNote(note, sender) {
  try {
    const savedNote = await saveNote(note);

    await log("note_saved", {
      id: savedNote.id,
      dateKey: savedNote.dateKey,
      url: savedNote.url,
      tabId: sender.tab ? sender.tab.id : null,
    });
    await refreshBadge("note_saved");

    return {
      ok: true,
      noteId: savedNote.id,
    };
  } catch (error) {
    await log("note_save_failed", {
      message: error.message,
    });

    return {
      ok: false,
      error: error.message || String(error),
    };
  }
}
