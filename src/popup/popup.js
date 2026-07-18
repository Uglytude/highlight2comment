import { getDateKey, renderNotes } from "../lib/markdown.js";
import { log } from "../lib/logger.js";
import { getMessage as t } from "../lib/i18n.js";
import { getNoteCount, getNotes, NOTES_KEY } from "../lib/storage.js";
import {
  authorizeDirectory,
  getConnectedDirectoryName,
  getDirectoryPermissionState,
  isFileSystemAccessSupported,
  LOG_FILE_NAME,
  reauthorizeDirectory,
} from "../lib/obsidian-writer.js";

const SYNC_MESSAGE = "H2C_SYNC";
const SERVICE_WORKER_TARGET = "service-worker";

const elements = {};
let syncInFlight = false;
let isBusy = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  applyStaticMessages();
  bindEvents();

  if (!isFileSystemAccessSupported()) {
    elements.connectButton.disabled = true;
    setObsidianState(t("obsidianStateUnsupported"));
  }

  await refreshSummary();
  await tryAutoSyncPendingNotes();
}

function bindElements() {
  elements.noteCount = document.getElementById("note-count");
  elements.obsidianState = document.getElementById("obsidian-state");
  elements.connectButton = document.getElementById("connect-button");
  elements.downloadButton = document.getElementById("download-button");
  elements.status = document.getElementById("status");
  elements.connectedDirectory = document.getElementById("connected-directory");
  elements.connectedDirectorySummary = document.getElementById("connected-directory-summary");
  elements.reauthorizeLink = document.getElementById("reauthorize-link");
}

function applyStaticMessages() {
  document.documentElement.lang = getDocumentLanguage();

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
}

function bindEvents() {
  elements.connectButton.addEventListener("click", handleConnectClick);
  elements.downloadButton.addEventListener("click", handleDownloadClick);
  elements.reauthorizeLink.addEventListener("click", handleReauthorizeClick);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    refreshSummary();

    if (changes[NOTES_KEY]) {
      tryAutoSyncPendingNotes();
    }
  });
}

async function refreshSummary() {
  const [count, permissionState] = await Promise.all([
    getNoteCount(),
    getDirectoryPermissionState(),
  ]);

  elements.noteCount.textContent = String(count);
  await updateObsidianConnection(permissionState);
}

async function handleConnectClick() {
  const permissionState = await getDirectoryPermissionState();

  await connectDirectory({
    action: authorizeDirectory,
    cancelLogAction: "obsidian_authorization_cancelled",
    failureLogAction: "obsidian_authorization_failed",
    startMessage: getConnectStartMessage(permissionState),
    successLogAction: "obsidian_directory_authorized",
  });
}

async function handleReauthorizeClick(event) {
  event.preventDefault();

  if (isBusy) {
    return;
  }

  await connectDirectory({
    action: reauthorizeDirectory,
    cancelLogAction: "obsidian_reauthorization_cancelled",
    failureLogAction: "obsidian_reauthorization_failed",
    startMessage: t("chooseNewObsidianFolderStatus"),
    successLogAction: "obsidian_directory_reauthorized",
  });
}

async function connectDirectory(options) {
  setStatus(options.startMessage);
  setBusy(true);

  try {
    await options.action();
    await log(options.successLogAction, {
      fileName: LOG_FILE_NAME,
    });
    setStatus(t("connectedWritingPendingStatus"));
    await syncPendingNotes(false);
  } catch (error) {
    if (isAbortError(error)) {
      await log(options.cancelLogAction, {
        fileName: LOG_FILE_NAME,
      });
      setStatus(getErrorMessage(error));
      return;
    }

    await log(options.failureLogAction, {
      message: getErrorMessage(error),
    });
    setStatus(getErrorMessage(error), true);
  } finally {
    setBusy(false);
    await refreshSummary();
  }
}

async function handleDownloadClick() {
  setBusy(true);

  try {
    const notes = await getNotes();

    if (notes.length === 0) {
      setStatus(t("noLocalNotesStatus"));
      return;
    }

    const markdown = renderNotes(notes, getMarkdownRenderOptions());
    const filename = `highlight2comment-${getDateKey(new Date())}.md`;
    downloadMarkdown(markdown, filename);

    await log("export_downloaded", {
      count: notes.length,
      filename,
    });
    setStatus(t("exportDownloadedStatus", [String(notes.length)]));
  } catch (error) {
    await log("export_download_failed", {
      message: getErrorMessage(error),
    });
    setStatus(getErrorMessage(error), true);
  } finally {
    setBusy(false);
  }
}

async function tryAutoSyncPendingNotes() {
  if (syncInFlight) {
    return;
  }

  await syncPendingNotes(true);
}

async function syncPendingNotes(silent) {
  if (syncInFlight) {
    return null;
  }

  syncInFlight = true;

  try {
    if (!silent) {
      setStatus(t("writingObsidianStatus"));
    }

    const result = await requestOffscreenSync(silent ? "popup_auto" : "popup_manual");
    showSyncResult(result, silent);
    return result;
  } catch (error) {
    await log("obsidian_sync_popup_request_failed", {
      message: getErrorMessage(error),
    });
    setStatus(getErrorMessage(error), true);
    return null;
  } finally {
    syncInFlight = false;
    await refreshSummary();
  }
}

function requestOffscreenSync(reason) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: SYNC_MESSAGE,
        target: SERVICE_WORKER_TARGET,
        reason,
      },
      (response) => {
        const runtimeError = chrome.runtime.lastError;

        if (runtimeError) {
          reject(new Error(runtimeError.message || String(runtimeError)));
          return;
        }

        resolve(response);
      },
    );
  });
}

function showSyncResult(result, silent) {
  if (!result) {
    setStatus(t("unknownErrorStatus"), true);
    return;
  }

  if (!result.ok) {
    setStatus(result.error || t("unknownErrorStatus"), true);
    return;
  }

  if (result.status === "synced") {
    setStatus(
      t("appendedToLogStatus", [
        String(result.count || 0),
        result.fileName || LOG_FILE_NAME,
      ]),
    );
    return;
  }

  if (result.status === "idle") {
    if (!silent) {
      setStatus(t("noPendingNotesStatus"));
    }
    return;
  }

  if (result.status === "needsAuth") {
    showNeedsAuthStatus(result.permissionState, silent);
    return;
  }

  if (result.status === "unsupported" && !silent) {
    setStatus(t("obsidianStateUnsupported"), true);
  }
}

function showNeedsAuthStatus(permissionState, silent) {
  if (permissionState === "missing") {
    if (!silent) {
      setStatus(t("obsidianFolderNotConnectedError"), true);
    }
    return;
  }

  if (permissionState === "prompt") {
    setStatus(t("reauthorizationRememberedStatus"), true);
    return;
  }

  if (permissionState === "denied") {
    setStatus(t("reauthorizationRequiredStatus"), true);
    return;
  }

  if (!silent) {
    setStatus(t("reauthorizationRequiredStatus"), true);
  }
}

function downloadMarkdown(markdown, filename) {
  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function setBusy(nextBusy) {
  isBusy = nextBusy;
  elements.connectButton.disabled = isBusy || !isFileSystemAccessSupported();
  elements.downloadButton.disabled = isBusy;
  elements.reauthorizeLink.classList.toggle("is-disabled", isBusy);
  elements.reauthorizeLink.setAttribute("aria-disabled", String(isBusy));
}

function setObsidianState(label) {
  elements.obsidianState.textContent = label;
}

async function updateObsidianConnection(permissionState) {
  const directoryName = await getDirectoryNameForState(permissionState);

  setObsidianState(permissionLabel(permissionState));
  setConnectButtonLabel(permissionState);
  setConnectedDirectory(permissionState, directoryName);
  setBusy(isBusy);
}

async function getDirectoryNameForState(permissionState) {
  if (permissionState !== "granted") {
    return "";
  }

  return getConnectedDirectoryName();
}

function setConnectedDirectory(permissionState, directoryName) {
  const isConnected = permissionState === "granted";

  elements.connectButton.hidden = isConnected;
  elements.connectedDirectory.hidden = !isConnected;
  elements.connectedDirectorySummary.textContent = isConnected
    ? t("connectedDirectorySummary", [directoryName])
    : "";
}

function setConnectButtonLabel(permissionState) {
  elements.connectButton.textContent = connectButtonLabel(permissionState);
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function permissionLabel(permissionState) {
  if (permissionState === "granted") {
    return t("obsidianStateConnected");
  }

  if (permissionState === "prompt") {
    return t("obsidianStateReauthorizationRemembered");
  }

  if (permissionState === "denied") {
    return t("obsidianStateReauthorizationRequired");
  }

  if (permissionState === "unsupported") {
    return t("obsidianStateUnsupported");
  }

  return t("obsidianStateNotConnected");
}

function connectButtonLabel(permissionState) {
  if (permissionState === "prompt" || permissionState === "denied") {
    return t("reconnectAndWriteObsidianButton");
  }

  return t("connectObsidianFolderButton");
}

function getConnectStartMessage(permissionState) {
  if (permissionState === "prompt" || permissionState === "denied") {
    return t("reconnectingObsidianFolderStatus");
  }

  return t("chooseObsidianFolderStatus");
}

function getErrorMessage(error) {
  if (error && error.name === "AbortError") {
    return t("folderSelectionCancelledStatus");
  }

  return error && error.message ? error.message : t("unknownErrorStatus");
}

function isAbortError(error) {
  return error && error.name === "AbortError";
}

function getMarkdownRenderOptions() {
  return {
    commentPrefix: t("logCommentPrefix"),
    unknownSourceLabel: t("unknownSource"),
  };
}

function getDocumentLanguage() {
  try {
    if (chrome.i18n && typeof chrome.i18n.getUILanguage === "function") {
      return chrome.i18n.getUILanguage().replace("_", "-");
    }
  } catch {
    // Keep the static HTML fallback.
  }

  return "en";
}
