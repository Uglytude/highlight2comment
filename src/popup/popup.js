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
  getDirectoryPermissionState,
  isFileSystemAccessSupported,
  LOG_FILE_NAME,
  readLogText,
} from "../lib/obsidian-writer.js";

const elements = {};
let syncInFlight = false;

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
}

function bindEvents() {
  elements.connectButton.addEventListener("click", handleConnectClick);
  elements.downloadButton.addEventListener("click", handleDownloadClick);

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
  setObsidianState(permissionLabel(permissionState));
}

async function handleConnectClick() {
  setStatus("请选择 Obsidian 文件夹。");
  setBusy(true);

  try {
    await authorizeDirectory();
    await log("obsidian_directory_authorized", {
      fileName: LOG_FILE_NAME,
    });
    setStatus("已连接,正在写入待追加笔记。");
    await syncPendingNotes(false);
  } catch (error) {
    await log("obsidian_authorization_failed", {
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
  if (!isFileSystemAccessSupported() || syncInFlight) {
    return;
  }

  const permissionState = await getDirectoryPermissionState();
  setObsidianState(permissionLabel(permissionState));

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

function setBusy(isBusy) {
  elements.connectButton.disabled = isBusy || !isFileSystemAccessSupported();
  elements.downloadButton.disabled = isBusy;
}

function setObsidianState(label) {
  elements.obsidianState.textContent = label;
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
