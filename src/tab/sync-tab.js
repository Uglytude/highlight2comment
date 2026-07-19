import { refreshBadge } from "../lib/badge.js";
import { getMessage as t } from "../lib/i18n.js";
import { log } from "../lib/logger.js";
import { mergeNotesIntoLog } from "../lib/markdown.js";
import {
  authorizeDirectory,
  getDirectoryPermissionState,
  LOG_FILE_NAME,
  readLogText,
  writeLogText,
} from "../lib/obsidian-writer.js";
import {
  getPendingNotes,
  markNotesWritten,
  NOTES_KEY,
  WRITTEN_NOTE_IDS_KEY,
} from "../lib/storage.js";

const SYNC_MESSAGE = "H2C_SYNC";
const WRITE_MESSAGE = "H2C_WRITE";
const ENSURE_SYNC_TAB_MESSAGE = "H2C_ENSURE_SYNC_TAB";
const SERVICE_WORKER_TARGET = "service-worker";
const SYNC_TAB_TARGET = "sync-tab";

const elements = {};
let isBusy = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isSyncTabWriteMessage(message)) {
    return false;
  }

  handleWriteMessage(message).then(sendResponse);
  return true;
});

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  showVersion();
  applyStaticMessages();
  bindEvents();
  await refreshState();
  await requestSyncOnReady();
}

function bindElements() {
  elements.status = document.getElementById("sync-status");
  elements.reconnectButton = document.getElementById("reconnect-button");
  elements.extensionVersion = document.getElementById("extension-version");
}

function showVersion() {
  elements.extensionVersion.textContent = `v${chrome.runtime.getManifest().version}`;
}

function applyStaticMessages() {
  document.documentElement.lang = getDocumentLanguage();
  document.title = t("syncTabDocumentTitle");

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
}

function bindEvents() {
  elements.reconnectButton.addEventListener("click", handleReconnectClick);
  chrome.storage.onChanged.addListener(handleStorageChanged);
}

function handleStorageChanged(changes, areaName) {
  if (
    areaName === "local" &&
    (changes[NOTES_KEY] || changes[WRITTEN_NOTE_IDS_KEY])
  ) {
    refreshState();
  }
}

async function handleWriteMessage(message) {
  try {
    const result = await writePendingNotes(message.renderOptions || {});

    await refreshState();
    return result;
  } catch (error) {
    setStatus(getErrorMessage(error), true);
    return createFailedSyncResult(error);
  }
}

async function writePendingNotes(renderOptions) {
  const pendingNotes = await getPendingNotes();

  if (pendingNotes.length === 0) {
    await refreshBadge("sync_tab_no_pending");
    return createSyncResult("idle", 0, null, 0);
  }

  const permissionState = await getDirectoryPermissionState();

  if (permissionState !== "granted") {
    await refreshBadge("sync_tab_needs_auth");
    return createUnavailableResult(permissionState, pendingNotes.length);
  }

  await appendPendingNotes(pendingNotes, renderOptions);
  await markNotesWritten(pendingNotes.map((note) => note.id));
  await refreshBadge("sync_tab_synced");
  return createSyncResult("synced", pendingNotes.length, permissionState, 0);
}

async function appendPendingNotes(pendingNotes, renderOptions) {
  const existingMarkdown = await readLogText();
  const fullMarkdown = mergeNotesIntoLog(
    pendingNotes,
    existingMarkdown,
    renderOptions,
  );

  await writeLogText(fullMarkdown);
}

async function handleReconnectClick() {
  let reconnectSucceeded = false;

  setBusy(true);
  setStatus(t("connectedWritingPendingStatus"));

  try {
    await authorizeDirectory();
    await log("obsidian_directory_authorized_from_sync_tab", {
      fileName: LOG_FILE_NAME,
    });
    await notifySyncTabEnsured();
    await requestServiceWorkerSync("sync_tab_reconnect");
    reconnectSucceeded = true;
  } catch (error) {
    await handleReconnectError(error);
  } finally {
    setBusy(false);

    if (reconnectSucceeded) {
      await refreshState();
    }
  }
}

async function handleReconnectError(error) {
  const action = isAbortError(error)
    ? "obsidian_authorization_cancelled"
    : "obsidian_authorization_failed";

  await log(action, { message: getErrorMessage(error) });
  setStatus(getErrorMessage(error), !isAbortError(error));
}

async function requestSyncOnReady() {
  try {
    await requestServiceWorkerSync("sync_tab_ready");
  } catch (error) {
    await log("sync_tab_ready_request_failed", {
      message: getErrorMessage(error),
    });
    await refreshState();
  }
}

async function notifySyncTabEnsured() {
  const result = await sendRuntimeMessage({
    type: ENSURE_SYNC_TAB_MESSAGE,
    target: SERVICE_WORKER_TARGET,
    reason: "sync_tab_authorized",
  });

  if (!result || !result.ok) {
    throw new Error(result?.error || "unknownErrorStatus");
  }
}

async function requestServiceWorkerSync(reason) {
  const result = await sendRuntimeMessage({
    type: SYNC_MESSAGE,
    target: SERVICE_WORKER_TARGET,
    reason,
  });

  if (!result || !result.ok) {
    throw new Error(result?.error || "unknownErrorStatus");
  }

  return result;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;

      if (runtimeError) {
        reject(new Error(runtimeError.message || String(runtimeError)));
        return;
      }

      resolve(response);
    });
  });
}

async function refreshState() {
  const [pendingNotes, permissionState] = await Promise.all([
    getPendingNotes(),
    getDirectoryPermissionState(),
  ]);

  setStatus(getStateMessage(permissionState, pendingNotes.length));
  elements.reconnectButton.hidden = permissionState === "granted";
}

function getStateMessage(permissionState, pendingCount) {
  const pendingMessage = t("syncTabStatusPending", [String(pendingCount)]);

  if (permissionState !== "granted") {
    return pendingCount > 0
      ? `${t("syncTabStatusReconnect")} · ${pendingMessage}`
      : t("syncTabStatusReconnect");
  }

  return pendingCount > 0 ? pendingMessage : t("syncTabStatusConnected");
}

function setBusy(nextBusy) {
  isBusy = nextBusy;
  elements.reconnectButton.disabled = isBusy;
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function isSyncTabWriteMessage(message) {
  return (
    message &&
    message.type === WRITE_MESSAGE &&
    message.target === SYNC_TAB_TARGET
  );
}

function createUnavailableResult(permissionState, pendingCount) {
  const status = permissionState === "unsupported" ? "unsupported" : "needsAuth";
  return createSyncResult(status, 0, permissionState, pendingCount);
}

function createSyncResult(status, count, permissionState, pendingCount) {
  return {
    ok: true,
    status,
    count,
    permissionState,
    pendingCount,
    fileName: LOG_FILE_NAME,
  };
}

function createFailedSyncResult(error) {
  return {
    ok: false,
    status: "failed",
    count: 0,
    error: getRawErrorMessage(error),
  };
}

function getErrorMessage(error) {
  if (isAbortError(error)) {
    return t("folderSelectionCancelledStatus");
  }

  return t(getRawErrorMessage(error));
}

function getRawErrorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function isAbortError(error) {
  return error && error.name === "AbortError";
}

function getDocumentLanguage() {
  try {
    return chrome.i18n.getUILanguage().replace("_", "-");
  } catch {
    return "en";
  }
}
