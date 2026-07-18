import { log } from "../lib/logger.js";
import { refreshBadge } from "../lib/badge.js";
import { getPendingNotes, markNotesWritten, saveNote } from "../lib/storage.js";
import { getMessage as t } from "../lib/i18n.js";

const SAVE_NOTE_MESSAGE = "H2C_SAVE_NOTE";
const SYNC_MESSAGE = "H2C_SYNC";
const WRITE_MESSAGE = "H2C_WRITE";
const OFFSCREEN_TARGET = "offscreen";
const OFFSCREEN_DOCUMENT_PATH = "offscreen/offscreen.html";
const OFFSCREEN_REASON = "BLOBS";
const OFFSCREEN_JUSTIFICATION = "Keep folder permission alive and sync notes";

let saveQueue = Promise.resolve();
let creatingOffscreenDocument = null;
let activeSync = null;
let rerunRequested = false;

chrome.runtime.onInstalled.addListener(() => {
  handleInstalled();
});

chrome.runtime.onStartup.addListener(() => {
  handleStartup();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === SAVE_NOTE_MESSAGE) {
    handleSaveNote(message.note, sender).then(sendResponse);
    return true;
  }

  if (isServiceWorkerSyncMessage(message)) {
    requestSync(message.reason || "message").then(sendResponse);
    return true;
  }

  return false;
});

async function handleSaveNote(note, sender) {
  try {
    const savedNote = await queueSaveNote(note);

    await log("note_saved", {
      id: savedNote.id,
      dateKey: savedNote.dateKey,
      url: savedNote.url,
      tabId: sender.tab ? sender.tab.id : null,
    });
    await refreshBadge("note_saved");
    const syncResult = await requestSync("note_saved");

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

function queueSaveNote(note) {
  const savePromise = saveQueue.then(
    () => saveNote(note),
    () => saveNote(note),
  );

  saveQueue = savePromise.catch(() => {});
  return savePromise;
}

async function handleInstalled() {
  await log("extension_installed", {
    version: chrome.runtime.getManifest().version,
  });
  await refreshBadge("installed");
  await requestSync("installed");
}

async function handleStartup() {
  await refreshBadge("startup");
  await requestSync("startup");
}

async function requestSync(reason) {
  if (activeSync) {
    const runningSync = activeSync;

    rerunRequested = true;
    await log("obsidian_sync_coalesced", {
      reason: normalizeReason(reason),
    });
    return runningSync;
  }

  activeSync = runSyncLoop(reason).finally(() => {
    activeSync = null;
  });
  return activeSync;
}

async function runSyncLoop(reason) {
  let totalCount = 0;
  let result;

  do {
    rerunRequested = false;
    result = await runSyncOnce(reason);
    totalCount += result.count || 0;
  } while (rerunRequested && shouldRerun(result));

  const finalStatus = totalCount > 0 && result.status === "idle" ? "synced" : result.status;

  return {
    ...result,
    status: finalStatus,
    count: totalCount,
  };
}

function shouldRerun(result) {
  return result && result.ok && (result.status === "synced" || result.status === "idle");
}

async function runSyncOnce(reason) {
  try {
    return await syncPendingNotes(reason);
  } catch (error) {
    const message = getErrorMessage(error);

    await log("obsidian_append_failed", {
      message,
      reason: normalizeReason(reason),
    });
    await refreshBadge("obsidian_sync_failed");

    return {
      ok: false,
      status: "failed",
      count: 0,
      error: message,
    };
  }
}

async function syncPendingNotes(reason) {
  const pendingNotes = await getPendingNotes();

  if (pendingNotes.length === 0) {
    await refreshBadge("obsidian_sync_no_pending");
    await log("obsidian_sync_no_pending", {
      reason: normalizeReason(reason),
    });
    return createSyncResult("idle", 0, null);
  }

  await ensureOffscreenDocument();
  const result = await sendWriteMessageToOffscreen(pendingNotes);
  return handleOffscreenWriteResult(result, pendingNotes, reason);
}

async function handleOffscreenWriteResult(result, pendingNotes, reason) {
  if (!result) {
    throw new Error("offscreen sync returned no response");
  }

  if (!result.ok) {
    await log("obsidian_append_failed", {
      message: result.error || "unknown offscreen write error",
      reason: normalizeReason(reason),
    });
    await refreshBadge("obsidian_sync_failed");
    return createFailedSyncResult(result.error);
  }

  if (result.status === "synced") {
    const syncedCount = result.count ?? pendingNotes.length;

    await markNotesWritten(pendingNotes.map((note) => note.id));
    await refreshBadge("obsidian_sync");
    await log("obsidian_append_succeeded", {
      count: syncedCount,
      reason: normalizeReason(reason),
    });
    return createSyncResult("synced", syncedCount, result.permissionState);
  }

  if (result.status === "needsAuth" || result.status === "unsupported") {
    await log("obsidian_sync_needs_auth", {
      permissionState: result.permissionState,
      reason: normalizeReason(reason),
    });
    await refreshBadge("obsidian_sync_needs_auth");
    return createSyncResult(result.status, 0, result.permissionState);
  }

  throw new Error(`unexpected offscreen sync status: ${result.status}`);
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

function sendWriteMessageToOffscreen(notes) {
  return chrome.runtime.sendMessage({
    type: WRITE_MESSAGE,
    target: OFFSCREEN_TARGET,
    notes,
    renderOptions: getMarkdownRenderOptions(),
  });
}

function isServiceWorkerSyncMessage(message) {
  return (
    message &&
    message.type === SYNC_MESSAGE &&
    message.target !== OFFSCREEN_TARGET
  );
}

function createSyncResult(status, count, permissionState) {
  return {
    ok: true,
    status,
    count,
    permissionState,
  };
}

function createFailedSyncResult(error) {
  return {
    ok: false,
    status: "failed",
    count: 0,
    error: error || "unknown offscreen write error",
  };
}

function getMarkdownRenderOptions() {
  return {
    commentPrefix: t("logCommentPrefix"),
    unknownSourceLabel: t("unknownSource"),
  };
}

function normalizeReason(reason) {
  return String(reason || "manual");
}

function getErrorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function isExistingOffscreenDocumentError(error) {
  const message = error && error.message ? error.message : String(error);
  return (
    message.includes("Only a single offscreen document") ||
    message.includes("already exists")
  );
}
