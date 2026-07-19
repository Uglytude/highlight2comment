import { getDateKey, renderNotes } from "../lib/markdown.js";
import { log } from "../lib/logger.js";
import { getMessage as t } from "../lib/i18n.js";
import {
  getNoteCount,
  getNotes,
  getPendingNotes,
  NOTES_KEY,
  WRITTEN_NOTE_IDS_KEY,
} from "../lib/storage.js";
import {
  authorizeDirectory,
  getConnectedDirectoryName,
  getDirectoryPermissionState,
  isFileSystemAccessSupported,
  LOG_FILE_NAME,
  reauthorizeDirectory,
} from "../lib/obsidian-writer.js";

const SYNC_MESSAGE = "H2C_SYNC";
const DELETE_NOTE_MESSAGE = "H2C_DELETE_NOTE";
const ENSURE_SYNC_TAB_MESSAGE = "H2C_ENSURE_SYNC_TAB";
const GET_SYNC_TAB_STATE_MESSAGE = "H2C_GET_SYNC_TAB_STATE";
const RESTORE_SYNC_TAB_MESSAGE = "H2C_RESTORE_SYNC_TAB";
const SERVICE_WORKER_TARGET = "service-worker";
const GUARDIAN_HINT_DISMISSED_KEY = "h2c_guardian_hint_dismissed";
const NOTE_PREVIEW_LIMIT = 90;
const DELETE_CONFIRM_WINDOW_MS = 3_000;
const DELETE_ICON = "✕";

const elements = {};
let syncInFlight = false;
let isBusy = false;
let guardianRecoveryNeeded = false;
let pendingDeleteId = null;
let pendingDeleteButton = null;
let deleteConfirmTimer = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  showVersion();
  applyStaticMessages();
  bindEvents();

  if (!isFileSystemAccessSupported()) {
    elements.connectButton.disabled = true;
    setObsidianState(t("obsidianStateUnsupported"));
  }

  await refreshSummary(true);
  await tryAutoSyncPendingNotes();
}

function bindElements() {
  elements.noteCountToggle = document.getElementById("note-count-toggle");
  elements.noteCount = document.getElementById("note-count");
  elements.notesPanel = document.getElementById("notes-panel");
  elements.notesPanelClose = document.getElementById("notes-panel-close");
  elements.notesList = document.getElementById("notes-list");
  elements.obsidianStateRow = document.getElementById("obsidian-state-row");
  elements.obsidianState = document.getElementById("obsidian-state");
  elements.guardianHint = document.getElementById("guardian-hint");
  elements.guardianHintDismiss = document.getElementById("guardian-hint-dismiss");
  elements.connectButton = document.getElementById("connect-button");
  elements.downloadButton = document.getElementById("download-button");
  elements.status = document.getElementById("status");
  elements.connectedDirectory = document.getElementById("connected-directory");
  elements.connectedDirectorySummary = document.getElementById("connected-directory-summary");
  elements.reauthorizeLink = document.getElementById("reauthorize-link");
  elements.extensionVersion = document.getElementById("extension-version");
}

function showVersion() {
  elements.extensionVersion.textContent = `v${chrome.runtime.getManifest().version}`;
}

function applyStaticMessages() {
  document.documentElement.lang = getDocumentLanguage();

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }
}

function bindEvents() {
  elements.noteCountToggle.addEventListener("click", toggleNotesPanel);
  elements.noteCountToggle.addEventListener("keydown", handleCountKeydown);
  elements.notesPanelClose.addEventListener("click", closeNotesPanel);
  elements.connectButton.addEventListener("click", handleConnectClick);
  elements.guardianHintDismiss.addEventListener("click", handleGuardianHintDismiss);
  elements.downloadButton.addEventListener("click", handleDownloadClick);
  elements.reauthorizeLink.addEventListener("click", handleReauthorizeClick);
  document.addEventListener("click", resetDeleteConfirmation);
  chrome.storage.onChanged.addListener(handleStorageChanged);
}

function handleStorageChanged(changes, areaName) {
  if (areaName !== "local") {
    return;
  }

  refreshSummary(true);

  if (
    !elements.notesPanel.hidden &&
    (changes[NOTES_KEY] || changes[WRITTEN_NOTE_IDS_KEY])
  ) {
    refreshNotesList();
  }

  if (changes[NOTES_KEY]) {
    tryAutoSyncPendingNotes();
  }
}

function handleCountKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  toggleNotesPanel();
}

async function toggleNotesPanel() {
  const shouldExpand = elements.notesPanel.hidden;
  setNotesPanelExpanded(shouldExpand);

  if (shouldExpand) {
    await refreshNotesList();
  }
}

function closeNotesPanel() {
  resetDeleteConfirmation();
  setNotesPanelExpanded(false);
  elements.noteCountToggle.focus();
}

function setNotesPanelExpanded(isExpanded) {
  elements.notesPanel.hidden = !isExpanded;
  elements.noteCountToggle.setAttribute("aria-expanded", String(isExpanded));
}

async function refreshNotesList() {
  const [notes, pendingNotes] = await Promise.all([getNotes(), getPendingNotes()]);
  const pendingIds = new Set(pendingNotes.map((note) => note.id));
  renderNotesList(notes, pendingIds);
}

function renderNotesList(notes, pendingIds) {
  resetDeleteConfirmation();
  elements.notesList.replaceChildren();
  const sortedNotes = sortNotesLatestFirst(notes);

  if (sortedNotes.length === 0) {
    elements.notesList.appendChild(createNotesEmptyState());
    return;
  }

  for (const note of sortedNotes) {
    elements.notesList.appendChild(createNoteItem(note, pendingIds.has(note.id)));
  }
}

function createNotesEmptyState() {
  return createTextElement("p", "notes-empty", t("noLocalNotesStatus"));
}

function createNoteItem(note, isPending) {
  const item = document.createElement("article");
  item.className = "note-item";
  item.appendChild(createDeleteButton(note.id));
  item.appendChild(createTextElement("p", "note-text", truncateText(note.text)));

  if (note.comment) {
    item.appendChild(createNoteComment(note.comment));
  }

  item.appendChild(createNoteMeta(note, isPending));
  return item;
}

function createDeleteButton(noteId) {
  const button = document.createElement("button");
  button.className = "note-delete-button";
  button.type = "button";
  button.textContent = DELETE_ICON;
  button.dataset.noteId = noteId;
  button.setAttribute("aria-label", t("deleteAction"));
  button.title = t("deleteAction");
  button.addEventListener("click", (event) => handleDeleteClick(event, noteId));
  return button;
}

async function handleDeleteClick(event, noteId) {
  event.stopPropagation();
  const button = event.currentTarget;

  if (pendingDeleteId !== noteId) {
    armDeleteConfirmation(button, noteId);
    return;
  }

  resetDeleteConfirmation();
  button.disabled = true;

  try {
    const result = await requestDeleteNote(noteId);

    if (!result || !result.ok) {
      throw new Error(result?.error || "unknownErrorStatus");
    }
  } catch (error) {
    button.disabled = false;
    setStatus(getErrorMessage(error), true);
  }
}

function requestDeleteNote(noteId) {
  return sendServiceWorkerMessage({
    type: DELETE_NOTE_MESSAGE,
    target: SERVICE_WORKER_TARGET,
    noteId,
  });
}

function armDeleteConfirmation(button, noteId) {
  resetDeleteConfirmation();
  pendingDeleteId = noteId;
  pendingDeleteButton = button;
  button.classList.add("is-confirming");
  button.textContent = t("deleteConfirm");
  button.setAttribute("aria-label", t("deleteConfirm"));
  button.title = t("deleteConfirm");
  deleteConfirmTimer = window.setTimeout(
    resetDeleteConfirmation,
    DELETE_CONFIRM_WINDOW_MS,
  );
}

function resetDeleteConfirmation() {
  window.clearTimeout(deleteConfirmTimer);
  deleteConfirmTimer = null;
  pendingDeleteId = null;

  if (pendingDeleteButton?.isConnected) {
    pendingDeleteButton.classList.remove("is-confirming");
    pendingDeleteButton.textContent = DELETE_ICON;
    pendingDeleteButton.setAttribute("aria-label", t("deleteAction"));
    pendingDeleteButton.title = t("deleteAction");
  }

  pendingDeleteButton = null;
}

function createNoteComment(comment) {
  return createTextElement("p", "note-comment", `${t("logCommentPrefix")}${comment}`);
}

function createNoteMeta(note, isPending) {
  const meta = document.createElement("p");
  meta.className = "note-meta";
  meta.appendChild(createNoteTime(note.ts));

  if (isPending) {
    meta.appendChild(createTextElement("span", "note-pending", t("pendingLabel")));
  }

  return meta;
}

function createNoteTime(timestamp) {
  const time = createTextElement("time", "note-time", formatNoteTime(timestamp));
  time.setAttribute("datetime", timestamp);
  return time;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function sortNotesLatestFirst(notes) {
  return [...notes].sort((left, right) => {
    const timeDifference = parseNoteTime(right.ts) - parseNoteTime(left.ts);
    return timeDifference || String(right.id).localeCompare(String(left.id));
  });
}

function parseNoteTime(timestamp) {
  return Date.parse(timestamp) || 0;
}

function truncateText(value, limit = NOTE_PREVIEW_LIMIT) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function formatNoteTime(timestamp, now = new Date()) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const time = `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
  return isSameLocalDay(date, now) ? time : `${getDateKey(date)} ${time}`;
}

function isSameLocalDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function padTime(value) {
  return String(value).padStart(2, "0");
}

async function refreshSummary(showQuietStatus = false) {
  const [count, pendingNotes, permissionState, syncTabState, hintState] =
    await Promise.all([
      getNoteCount(),
      getPendingNotes(),
      getDirectoryPermissionState(),
      getSyncTabState(),
      chrome.storage.local.get({ [GUARDIAN_HINT_DISMISSED_KEY]: false }),
    ]);

  elements.noteCount.textContent = String(count);
  await updateObsidianConnection(permissionState, syncTabState);
  updateGuardianHint(permissionState, syncTabState, hintState);

  if (showQuietStatus) {
    showQuietReconnectStatus(permissionState, pendingNotes.length);
  }
}

async function handleConnectClick() {
  const permissionState = await getDirectoryPermissionState();

  if (guardianRecoveryNeeded) {
    await restoreAutoSync(permissionState);
    return;
  }

  await connectDirectory({
    action: authorizeDirectory,
    cancelLogAction: "obsidian_authorization_cancelled",
    failureLogAction: "obsidian_authorization_failed",
    startMessage: getConnectStartMessage(permissionState),
    successLogAction: "obsidian_directory_authorized",
  });
}

async function handleGuardianHintDismiss() {
  elements.guardianHint.hidden = true;

  try {
    await chrome.storage.local.set({ [GUARDIAN_HINT_DISMISSED_KEY]: true });
  } catch (error) {
    elements.guardianHint.hidden = false;
    await log("guardian_hint_dismiss_failed", {
      message: getErrorMessage(error),
    });
    setStatus(getErrorMessage(error), true);
  }
}

async function restoreAutoSync(permissionState) {
  setStatus(t("restoringAutoSyncStatus"));
  setBusy(true);

  try {
    await restorePermissionIfNeeded(permissionState);
    const result = await requestGuardianRestore();
    showSyncResult(result, false);
  } catch (error) {
    await handleGuardianRestoreError(error);
  } finally {
    setBusy(false);
    await refreshSummary(false);
  }
}

async function restorePermissionIfNeeded(permissionState) {
  if (permissionState === "granted") {
    return;
  }

  await authorizeDirectory();
  await log("obsidian_directory_authorized", {
    fileName: LOG_FILE_NAME,
    reason: "guardian_restore",
  });
}

async function handleGuardianRestoreError(error) {
  const action = isAbortError(error)
    ? "obsidian_authorization_cancelled"
    : "sync_tab_restore_popup_failed";

  await log(action, { message: getErrorMessage(error) });
  setStatus(getErrorMessage(error), !isAbortError(error));
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
    await ensureSyncTabAfterAuthorization();
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
    await refreshSummary(false);
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

    const result = await requestServiceWorkerSync(silent ? "popup_auto" : "popup_manual");
    showSyncResult(result, silent);
    return result;
  } catch (error) {
    await log("obsidian_sync_popup_request_failed", {
      message: getErrorMessage(error),
    });
    setStatus(getErrorMessage(error), !silent);
    return null;
  } finally {
    syncInFlight = false;
    await refreshSummary(false);
  }
}

function requestServiceWorkerSync(reason) {
  return sendServiceWorkerMessage({
    type: SYNC_MESSAGE,
    target: SERVICE_WORKER_TARGET,
    reason,
  });
}

async function ensureSyncTabAfterAuthorization() {
  const result = await sendServiceWorkerMessage({
    type: ENSURE_SYNC_TAB_MESSAGE,
    target: SERVICE_WORKER_TARGET,
    reason: "popup_authorized",
  });

  if (!result || !result.ok) {
    throw new Error(result?.error || "unknownErrorStatus");
  }
}

async function getSyncTabState() {
  try {
    const result = await sendServiceWorkerMessage({
      type: GET_SYNC_TAB_STATE_MESSAGE,
      target: SERVICE_WORKER_TARGET,
    });

    if (result && result.ok) {
      return {
        alive: result.alive === true,
        suppressed: result.suppressed === true,
      };
    }
  } catch {
    // Keep the neutral state when the service worker cannot be reached.
  }

  return { alive: false, suppressed: false };
}

function requestGuardianRestore() {
  return sendServiceWorkerMessage({
    type: RESTORE_SYNC_TAB_MESSAGE,
    target: SERVICE_WORKER_TARGET,
  });
}

function sendServiceWorkerMessage(message) {
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

function showSyncResult(result, silent) {
  if (!result) {
    setStatus(t("unknownErrorStatus"), !silent);
    return;
  }

  if (!result.ok) {
    const message = result.error ? t(result.error) : t("unknownErrorStatus");
    setStatus(message, !silent);
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
    showNeedsAuthStatus(result.pendingCount || 0, silent);
    return;
  }

  if (result.status === "unsupported" && !silent) {
    setStatus(t("obsidianStateUnsupported"), true);
  }
}

function showNeedsAuthStatus(pendingCount, silent) {
  setStatus(
    t("obsidianReconnectPendingStatus", [String(pendingCount)]),
    !silent,
  );
}

function showQuietReconnectStatus(permissionState, pendingCount) {
  if (!isNeedsAuthorization(permissionState)) {
    return;
  }

  setStatus(t("obsidianReconnectPendingStatus", [String(pendingCount)]));
}

function isNeedsAuthorization(permissionState) {
  return (
    permissionState === "missing" ||
    permissionState === "prompt" ||
    permissionState === "denied"
  );
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

async function updateObsidianConnection(permissionState, syncTabState) {
  const directoryName = await getDirectoryNameForState(permissionState);
  guardianRecoveryNeeded = isGuardianPaused(syncTabState);

  setObsidianState(permissionLabel(permissionState, syncTabState));
  elements.obsidianStateRow.classList.toggle(
    "guardian-paused",
    guardianRecoveryNeeded,
  );
  setConnectButtonLabel(permissionState, guardianRecoveryNeeded);
  setConnectedDirectory(permissionState, directoryName, guardianRecoveryNeeded);
  setBusy(isBusy);
}

function updateGuardianHint(permissionState, syncTabState, hintState) {
  const wasDismissed = hintState[GUARDIAN_HINT_DISMISSED_KEY] === true;
  const shouldShow =
    permissionState === "granted" && syncTabState.alive && !wasDismissed;

  elements.guardianHint.hidden = !shouldShow;
}

async function getDirectoryNameForState(permissionState) {
  if (permissionState !== "granted") {
    return "";
  }

  return getConnectedDirectoryName();
}

function setConnectedDirectory(permissionState, directoryName, guardianPaused) {
  const isConnected = permissionState === "granted";

  elements.connectButton.hidden = isConnected && !guardianPaused;
  elements.connectedDirectory.hidden = !isConnected;
  elements.connectedDirectorySummary.textContent = isConnected
    ? t("connectedDirectorySummary", [directoryName])
    : "";
}

function setConnectButtonLabel(permissionState, guardianPaused) {
  elements.connectButton.textContent = guardianPaused
    ? t("restoreAutoSyncButton")
    : connectButtonLabel(permissionState);
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function permissionLabel(permissionState, syncTabState) {
  if (isGuardianPaused(syncTabState)) {
    return t("obsidianStateSyncGuardianPaused");
  }

  if (permissionState === "granted") {
    return syncTabState.alive
      ? t("obsidianStateSyncGuardianActive")
      : t("obsidianStateConnected");
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

function isGuardianPaused(syncTabState) {
  return !syncTabState.alive && syncTabState.suppressed;
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

  if (error && error.message) {
    return t(error.message);
  }

  return t("unknownErrorStatus");
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
