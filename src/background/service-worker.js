import { log } from "../lib/logger.js";
import { refreshBadge } from "../lib/badge.js";
import {
  deleteNote,
  findRecentDuplicate,
  getPendingNotes,
  markNotesWritten,
  saveNote,
} from "../lib/storage.js";
import { getMessage as t } from "../lib/i18n.js";

const SAVE_NOTE_MESSAGE = "H2C_SAVE_NOTE";
const DELETE_NOTE_MESSAGE = "H2C_DELETE_NOTE";
const SYNC_MESSAGE = "H2C_SYNC";
const WRITE_MESSAGE = "H2C_WRITE";
const ENSURE_SYNC_TAB_MESSAGE = "H2C_ENSURE_SYNC_TAB";
const GET_SYNC_TAB_STATE_MESSAGE = "H2C_GET_SYNC_TAB_STATE";
const SERVICE_WORKER_TARGET = "service-worker";
const SYNC_TAB_TARGET = "sync-tab";
const OFFSCREEN_TARGET = "offscreen";
const SYNC_TAB_PATH = "tab/sync-tab.html";
const OFFSCREEN_DOCUMENT_PATH = "offscreen/offscreen.html";
const SYNC_TAB_ID_KEY = "syncTabId";
const SYNC_TAB_SUPPRESSED_KEY = "syncTabSuppressed";
const NEEDS_AUTH_LOGGED_KEY = "needsAuthLogged";
const OFFSCREEN_REASON = "BLOBS";
const OFFSCREEN_JUSTIFICATION = "Keep folder permission alive and sync notes";
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

let noteMutationQueue = Promise.resolve();
let deleteQueue = Promise.resolve();
let creatingSyncTab = null;
let creatingOffscreenDocument = null;
let activeSync = null;
let rerunRequested = false;
let needsAuthLoggedThisSession = false;

chrome.runtime.onInstalled.addListener(() => {
  handleInstalled();
});

chrome.runtime.onStartup.addListener(() => {
  handleStartup();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  handleSyncTabRemoved(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === SAVE_NOTE_MESSAGE) {
    handleSaveNote(message.note, sender).then(sendResponse);
    return true;
  }

  if (message && message.type === DELETE_NOTE_MESSAGE) {
    handleDeleteNote(message.noteId).then(sendResponse);
    return true;
  }

  if (isEnsureSyncTabMessage(message)) {
    handleEnsureSyncTabMessage(message).then(sendResponse);
    return true;
  }

  if (isGetSyncTabStateMessage(message)) {
    getSyncTabState().then(sendResponse);
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
    const result = await queueSaveNote(note);

    if (result.duplicate) {
      await logDuplicateSkipped(result.note, note, sender);
      return { ok: true, duplicate: true };
    }

    const savedNote = result.note;

    await logSavedNote(savedNote, sender);
    await refreshBadge("note_saved");
    await ensureSyncTabSafely("note_saved", false);
    await requestSync("note_saved");

    return {
      ok: true,
      noteId: savedNote.id,
    };
  } catch (error) {
    await log("note_save_failed", {
      message: getErrorMessage(error),
    });

    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

function logSavedNote(savedNote, sender) {
  return log("note_saved", {
    id: savedNote.id,
    dateKey: savedNote.dateKey,
    url: savedNote.url,
    tabId: sender.tab ? sender.tab.id : null,
  });
}

function logDuplicateSkipped(existingNote, skippedNote, sender) {
  return log("note_duplicate_skipped", {
    existingNoteId: existingNote.id,
    skippedNoteId: skippedNote.id,
    url: existingNote.url,
    tabId: sender.tab ? sender.tab.id : null,
  });
}

function queueSaveNote(note) {
  return queueNoteMutation(() => saveNoteUnlessDuplicate(note));
}

function queueNoteMutation(operation) {
  const mutationPromise = noteMutationQueue.then(operation, operation);

  noteMutationQueue = mutationPromise.catch(() => {});
  return mutationPromise;
}

async function saveNoteUnlessDuplicate(note) {
  const duplicateNote = await findRecentDuplicate(note, DUPLICATE_WINDOW_MS);

  if (duplicateNote) {
    return { duplicate: true, note: duplicateNote };
  }

  return { duplicate: false, note: await saveNote(note) };
}

async function handleDeleteNote(noteId) {
  try {
    const deleted = await queueDeleteNote(noteId);

    if (deleted) {
      await log("note_deleted", { id: noteId });
    }

    return { ok: true, deleted };
  } catch (error) {
    await log("note_delete_failed", {
      id: noteId,
      message: getErrorMessage(error),
    });
    return { ok: false, error: getErrorMessage(error) };
  }
}

function queueDeleteNote(noteId) {
  const syncToWaitFor = activeSync;
  const deletePromise = queueNoteMutation(() =>
    deleteNoteAfterSync(noteId, syncToWaitFor),
  );

  deleteQueue = deletePromise.catch(() => {});
  return deletePromise;
}

async function deleteNoteAfterSync(noteId, syncToWaitFor) {
  if (syncToWaitFor) {
    await syncToWaitFor.catch(() => {});
  }

  return deleteNote(noteId);
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
  await ensureSyncTabSafely("startup", true);
  await requestSync("startup");
}

async function handleEnsureSyncTabMessage(message) {
  try {
    const tab = await ensureSyncTab(message.reason || "authorized", true);
    return {
      ok: true,
      alive: Boolean(tab),
      tabId: tab ? tab.id : null,
    };
  } catch (error) {
    await log("sync_tab_ensure_failed", {
      message: getErrorMessage(error),
      reason: normalizeReason(message.reason),
    });
    return {
      ok: false,
      alive: false,
      error: getErrorMessage(error),
    };
  }
}

async function ensureSyncTabSafely(reason, forceCreate) {
  try {
    return await ensureSyncTab(reason, forceCreate);
  } catch (error) {
    await log("sync_tab_ensure_failed", {
      message: getErrorMessage(error),
      reason: normalizeReason(reason),
    });
    return null;
  }
}

async function ensureSyncTab(reason, forceCreate) {
  const state = await getStoredSyncTabState();
  const existingTab = await getLiveTab(state.tabId);

  if (existingTab) {
    return existingTab;
  }

  if (!forceCreate && state.suppressed) {
    return null;
  }

  if (!forceCreate && Number.isInteger(state.tabId)) {
    await rememberClosedSyncTab(state.tabId, reason);
    return null;
  }

  if (!creatingSyncTab) {
    creatingSyncTab = createSyncTab(reason);
  }

  try {
    return await creatingSyncTab;
  } finally {
    creatingSyncTab = null;
  }
}

async function createSyncTab(reason) {
  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL(SYNC_TAB_PATH),
    pinned: true,
    active: false,
  });

  if (!tab || !Number.isInteger(tab.id)) {
    throw new Error("sync tab creation returned no tab id");
  }

  await chrome.storage.local.set({
    [SYNC_TAB_ID_KEY]: tab.id,
    [SYNC_TAB_SUPPRESSED_KEY]: false,
  });
  await log("sync_tab_created", {
    reason: normalizeReason(reason),
    tabId: tab.id,
  });
  return tab;
}

async function getSyncTabState() {
  const state = await getStoredSyncTabState();
  const tab = await getLiveTab(state.tabId);

  if (tab) {
    return { ok: true, alive: true, tabId: tab.id };
  }

  if (Number.isInteger(state.tabId)) {
    await rememberClosedSyncTab(state.tabId, "state_check");
  }

  return { ok: true, alive: false, tabId: null };
}

async function getStoredSyncTabState() {
  const data = await chrome.storage.local.get({
    [SYNC_TAB_ID_KEY]: null,
    [SYNC_TAB_SUPPRESSED_KEY]: false,
  });

  return {
    tabId: Number.isInteger(data[SYNC_TAB_ID_KEY])
      ? data[SYNC_TAB_ID_KEY]
      : null,
    suppressed: data[SYNC_TAB_SUPPRESSED_KEY] === true,
  };
}

async function getLiveTab(tabId) {
  if (!Number.isInteger(tabId)) {
    return null;
  }

  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function handleSyncTabRemoved(tabId) {
  const state = await getStoredSyncTabState();

  if (state.tabId !== tabId) {
    return;
  }

  await rememberClosedSyncTab(tabId, "tab_closed");
}

async function rememberClosedSyncTab(tabId, reason) {
  await chrome.storage.local.set({
    [SYNC_TAB_ID_KEY]: null,
    [SYNC_TAB_SUPPRESSED_KEY]: true,
  });
  await log("sync_tab_closed_manual_mode", {
    reason: normalizeReason(reason),
    tabId,
  });
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

  const pendingDeletes = deleteQueue;
  activeSync = runSyncAfterDeletes(reason, pendingDeletes).finally(() => {
    activeSync = null;
  });
  return activeSync;
}

async function runSyncAfterDeletes(reason, pendingDeletes) {
  await pendingDeletes;
  return runSyncLoop(reason);
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
  return { ...result, status: finalStatus, count: totalCount };
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
    return createFailedSyncResult(message);
  }
}

async function syncPendingNotes(reason) {
  const pendingNotes = await getPendingNotes();

  if (pendingNotes.length === 0) {
    return handleNoPendingNotes(reason);
  }

  const syncTabResult = await sendWriteMessageToSyncTab();

  if (syncTabResult) {
    return handleSyncTabWriteResult(syncTabResult, pendingNotes, reason);
  }

  return syncPendingNotesWithOffscreen(pendingNotes, reason);
}

async function handleNoPendingNotes(reason) {
  await refreshBadge("obsidian_sync_no_pending");
  await log("obsidian_sync_no_pending", {
    reason: normalizeReason(reason),
  });
  return createSyncResult("idle", 0, null, 0);
}

async function sendWriteMessageToSyncTab() {
  const state = await getSyncTabState();

  if (!state.alive) {
    return null;
  }

  const message = createWriteMessage(SYNC_TAB_TARGET);

  try {
    const result = await chrome.tabs.sendMessage(state.tabId, message);

    if (result) {
      return result;
    }
  } catch {
    // Extension pages are not content scripts; use runtime messaging below.
  }

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    await log("sync_tab_message_failed", {
      message: getErrorMessage(error),
      tabId: state.tabId,
    });
    return null;
  }
}

async function handleSyncTabWriteResult(result, pendingNotes, reason) {
  if (!result) {
    return syncPendingNotesWithOffscreen(pendingNotes, reason);
  }

  if (!result.ok) {
    return handleWriterFailure(result, reason, "sync tab");
  }

  if (result.status === "synced") {
    await logSyncSucceeded(result, pendingNotes.length, reason, SYNC_TAB_TARGET);
    return createSyncResult(
      "synced",
      result.count ?? pendingNotes.length,
      result.permissionState,
      result.pendingCount || 0,
      result.fileName,
    );
  }

  return handleUnavailableWriteResult(result, pendingNotes.length, reason);
}

async function syncPendingNotesWithOffscreen(pendingNotes, reason) {
  await ensureOffscreenDocument();
  const result = await sendWriteMessageToOffscreen(pendingNotes);
  return handleOffscreenWriteResult(result, pendingNotes, reason);
}

async function handleOffscreenWriteResult(result, pendingNotes, reason) {
  if (!result) {
    throw new Error("offscreen sync returned no response");
  }

  if (!result.ok) {
    return handleWriterFailure(result, reason, OFFSCREEN_TARGET);
  }

  if (result.status === "synced") {
    const syncedCount = result.count ?? pendingNotes.length;

    await markNotesWritten(pendingNotes.map((note) => note.id));
    await refreshBadge("obsidian_sync");
    await logSyncSucceeded(result, syncedCount, reason, OFFSCREEN_TARGET);
    return createSyncResult(
      "synced",
      syncedCount,
      result.permissionState,
      0,
      result.fileName,
    );
  }

  return handleUnavailableWriteResult(result, pendingNotes.length, reason);
}

async function handleWriterFailure(result, reason, writer) {
  const message = result.error || `unknown ${writer} write error`;

  await log("obsidian_append_failed", {
    message,
    reason: normalizeReason(reason),
    writer,
  });
  await refreshBadge("obsidian_sync_failed");
  return createFailedSyncResult(message);
}

async function handleUnavailableWriteResult(result, pendingCount, reason) {
  if (result.status !== "needsAuth" && result.status !== "unsupported") {
    throw new Error(`unexpected sync status: ${result.status}`);
  }

  if (result.status === "needsAuth") {
    await logNeedsAuthOnce(result.permissionState, reason);
  }

  await refreshBadge("obsidian_sync_needs_auth");
  return createSyncResult(
    result.status,
    0,
    result.permissionState,
    result.pendingCount ?? pendingCount,
    result.fileName,
  );
}

async function logNeedsAuthOnce(permissionState, reason) {
  if (await wasNeedsAuthLoggedThisSession()) {
    return;
  }

  needsAuthLoggedThisSession = true;
  await rememberNeedsAuthLoggedThisSession();
  await log("obsidian_sync_needs_auth", {
    permissionState,
    reason: normalizeReason(reason),
  });
}

async function wasNeedsAuthLoggedThisSession() {
  if (needsAuthLoggedThisSession) {
    return true;
  }

  try {
    const data = await chrome.storage.session.get({
      [NEEDS_AUTH_LOGGED_KEY]: false,
    });
    needsAuthLoggedThisSession = data[NEEDS_AUTH_LOGGED_KEY] === true;
  } catch {
    // Keep the in-memory fallback for older Chrome versions.
  }

  return needsAuthLoggedThisSession;
}

async function rememberNeedsAuthLoggedThisSession() {
  try {
    await chrome.storage.session.set({ [NEEDS_AUTH_LOGGED_KEY]: true });
  } catch {
    // The in-memory flag still prevents repeats during this worker lifetime.
  }
}

function logSyncSucceeded(result, count, reason, writer) {
  return log("obsidian_append_succeeded", {
    count,
    reason: normalizeReason(reason),
    writer,
    fileName: result.fileName,
  });
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
    ...createWriteMessage(OFFSCREEN_TARGET),
    notes,
  });
}

function createWriteMessage(target) {
  return {
    type: WRITE_MESSAGE,
    target,
    renderOptions: getMarkdownRenderOptions(),
  };
}

function isEnsureSyncTabMessage(message) {
  return (
    message &&
    message.type === ENSURE_SYNC_TAB_MESSAGE &&
    message.target === SERVICE_WORKER_TARGET
  );
}

function isGetSyncTabStateMessage(message) {
  return (
    message &&
    message.type === GET_SYNC_TAB_STATE_MESSAGE &&
    message.target === SERVICE_WORKER_TARGET
  );
}

function isServiceWorkerSyncMessage(message) {
  return (
    message &&
    message.type === SYNC_MESSAGE &&
    message.target === SERVICE_WORKER_TARGET
  );
}

function createSyncResult(
  status,
  count,
  permissionState,
  pendingCount,
  fileName = null,
) {
  return {
    ok: true,
    status,
    count,
    permissionState,
    pendingCount,
    fileName,
  };
}

function createFailedSyncResult(error) {
  return {
    ok: false,
    status: "failed",
    count: 0,
    error: error || "unknown write error",
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
  const message = getErrorMessage(error);
  return (
    message.includes("Only a single offscreen document") ||
    message.includes("already exists")
  );
}
