import { log } from "../lib/logger.js";
import { refreshBadge } from "../lib/badge.js";
import { saveNote } from "../lib/storage.js";

const SAVE_NOTE_MESSAGE = "H2C_SAVE_NOTE";
const SYNC_MESSAGE = "H2C_SYNC";
const OFFSCREEN_TARGET = "offscreen";
const OFFSCREEN_DOCUMENT_PATH = "offscreen/offscreen.html";
const OFFSCREEN_REASON = "BLOBS";
const OFFSCREEN_JUSTIFICATION = "Keep folder permission alive and sync notes";

let saveQueue = Promise.resolve();
let creatingOffscreenDocument = null;

chrome.runtime.onInstalled.addListener(() => {
  handleInstalled();
});

chrome.runtime.onStartup.addListener(() => {
  handleStartup();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === SAVE_NOTE_MESSAGE) {
    saveQueue = saveQueue.then(
      () => handleSaveNote(message.note, sender),
      () => handleSaveNote(message.note, sender),
    );

    saveQueue.then(sendResponse);
    return true;
  }

  if (isServiceWorkerSyncMessage(message)) {
    requestOffscreenSync(message.reason || "message").then(sendResponse);
    return true;
  }

  return false;
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
    const syncResult = await requestOffscreenSync("note_saved");

    return {
      ok: true,
      noteId: savedNote.id,
      sync: syncResult,
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

async function handleInstalled() {
  await log("extension_installed", {
    version: chrome.runtime.getManifest().version,
  });
  await refreshBadge("installed");
  await requestOffscreenSync("installed");
}

async function handleStartup() {
  await refreshBadge("startup");
  await requestOffscreenSync("startup");
}

async function requestOffscreenSync(reason) {
  try {
    await ensureOffscreenDocument();
    return await sendMessageToOffscreen(reason);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);

    await log("obsidian_sync_request_failed", {
      message,
      reason,
    });

    return {
      ok: false,
      status: "failed",
      count: 0,
      error: message,
    };
  }
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== "function") {
    throw new Error("chrome.offscreen is unavailable");
  }

  if (await hasOffscreenDocument()) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = createOffscreenDocument();
  }

  try {
    await creatingOffscreenDocument;
  } finally {
    creatingOffscreenDocument = null;
  }
}

async function hasOffscreenDocument() {
  if (typeof chrome.runtime.getContexts !== "function") {
    return false;
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });

  return contexts.length > 0;
}

async function createOffscreenDocument() {
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [OFFSCREEN_REASON],
      justification: OFFSCREEN_JUSTIFICATION,
    });

    await log("offscreen_document_created", {
      path: OFFSCREEN_DOCUMENT_PATH,
    });
  } catch (error) {
    if (isExistingOffscreenDocumentError(error)) {
      await log("offscreen_document_reused", {
        path: OFFSCREEN_DOCUMENT_PATH,
      });
      return;
    }

    throw error;
  }
}

function sendMessageToOffscreen(reason) {
  return chrome.runtime.sendMessage({
    type: SYNC_MESSAGE,
    target: OFFSCREEN_TARGET,
    reason,
  });
}

function isServiceWorkerSyncMessage(message) {
  return (
    message &&
    message.type === SYNC_MESSAGE &&
    message.target !== OFFSCREEN_TARGET
  );
}

function isExistingOffscreenDocumentError(error) {
  const message = error && error.message ? error.message : String(error);
  return (
    message.includes("Only a single offscreen document") ||
    message.includes("already exists")
  );
}
