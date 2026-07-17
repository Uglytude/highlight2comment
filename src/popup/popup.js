import { getDateKey, renderNotes, renderNotesForAppend } from "../lib/markdown.js";
import { log } from "../lib/logger.js";
import {
  getNoteCount,
  getNotes,
  getPendingNotes,
  markNotesWritten,
  NOTES_KEY,
} from "../lib/storage.js";
import {
  appendToLog,
  authorizeDirectory,
  getConnectedDirectoryName,
  getDirectoryPermissionState,
  isFileSystemAccessSupported,
  LOG_FILE_NAME,
  readLogText,
  reauthorizeDirectory,
} from "../lib/obsidian-writer.js";

const elements = {};
let syncInFlight = false;
let isBusy = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();

  if (!isFileSystemAccessSupported()) {
    elements.connectButton.disabled = true;
    setObsidianState("当前浏览器不支持");
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
  elements.connectedDirectoryName = document.getElementById("connected-directory-name");
  elements.reauthorizeLink = document.getElementById("reauthorize-link");
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
  await connectDirectory({
    action: authorizeDirectory,
    cancelLogAction: "obsidian_authorization_cancelled",
    failureLogAction: "obsidian_authorization_failed",
    startMessage: "请选择 Obsidian 文件夹。",
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
    startMessage: "请选择新的 Obsidian 文件夹。",
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
    setStatus("已连接,正在写入待追加笔记。");
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
      setStatus("还没有本地笔记。");
      return;
    }

    const markdown = renderNotes(notes);
    const filename = `highlight2comment-${getDateKey(new Date())}.md`;
    downloadMarkdown(markdown, filename);

    await log("export_downloaded", {
      count: notes.length,
      filename,
    });
    setStatus(`已下载 ${notes.length} 条笔记。`);
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

  const permissionState = await getDirectoryPermissionState();
  await updateObsidianConnection(permissionState);

  if (permissionState === "unsupported") {
    return;
  }

  if (permissionState === "granted") {
    await syncPendingNotes(true);
    return;
  }

  if (permissionState === "denied" || permissionState === "prompt") {
    setStatus("Obsidian 需要重新授权;本地笔记仍然保存在浏览器里。", true);
  }
}

async function syncPendingNotes(silent) {
  if (syncInFlight) {
    return;
  }

  syncInFlight = true;

  try {
    const pendingNotes = await getPendingNotes();

    if (pendingNotes.length === 0) {
      if (!silent) {
        setStatus("没有待追加笔记。");
      }
      return;
    }

    if (!silent) {
      setStatus("正在写入 Obsidian。");
    }

    const existingMarkdown = await readLogText();
    const appendMarkdown = renderNotesForAppend(pendingNotes, existingMarkdown);
    await appendToLog(appendMarkdown);
    await markNotesWritten(pendingNotes.map((note) => note.id));

    await log("obsidian_append_succeeded", {
      count: pendingNotes.length,
      fileName: LOG_FILE_NAME,
    });
    setStatus(`已追加 ${pendingNotes.length} 条到 ${LOG_FILE_NAME}。`);
  } catch (error) {
    await log("obsidian_append_failed", {
      message: getErrorMessage(error),
    });
    setStatus(getErrorMessage(error), true);
  } finally {
    syncInFlight = false;
    await refreshSummary();
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
  elements.connectedDirectoryName.textContent = directoryName;
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function permissionLabel(permissionState) {
  if (permissionState === "granted") {
    return "已连接";
  }

  if (permissionState === "prompt" || permissionState === "denied") {
    return "需重新授权";
  }

  if (permissionState === "unsupported") {
    return "不支持";
  }

  return "未连接";
}

function getErrorMessage(error) {
  if (error && error.name === "AbortError") {
    return "已取消选择文件夹。";
  }

  return error && error.message ? error.message : String(error);
}

function isAbortError(error) {
  return error && error.name === "AbortError";
}
