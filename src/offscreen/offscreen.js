import { mergeNotesIntoLog } from "../lib/markdown.js";
import { log } from "../lib/logger.js";
import { refreshBadge } from "../lib/badge.js";
import { getMessage as t } from "../lib/i18n.js";
import { getPendingNotes, markNotesWritten } from "../lib/storage.js";
import {
  getSavedDirectoryPermissionState,
  LOG_FILE_NAME,
  readLogText,
  writeLogText,
} from "../lib/obsidian-writer.js";

const SYNC_MESSAGE = "H2C_SYNC";
const OFFSCREEN_TARGET = "offscreen";

let activeSync = null;
let rerunRequested = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isOffscreenSyncMessage(message)) {
    return false;
  }

  queueSync(message.reason).then(sendResponse);
  return true;
});

function isOffscreenSyncMessage(message) {
  return (
    message &&
    message.type === SYNC_MESSAGE &&
    (!message.target || message.target === OFFSCREEN_TARGET)
  );
}

function queueSync(reason) {
  if (activeSync) {
    rerunRequested = true;
    log("obsidian_sync_coalesced", {
      reason: normalizeReason(reason),
    });
    return activeSync;
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
  return result.ok && (result.status === "synced" || result.status === "idle");
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
      fileName: LOG_FILE_NAME,
    };
  }
}

async function syncPendingNotes(reason) {
  const permissionState = await getSavedDirectoryPermissionState();

  if (permissionState !== "granted") {
    return handleSyncWithoutPermission(permissionState, reason);
  }

  const pendingNotes = await getPendingNotes();

  if (pendingNotes.length === 0) {
    await log("obsidian_sync_no_pending", {
      reason: normalizeReason(reason),
      fileName: LOG_FILE_NAME,
    });
    await refreshBadge("obsidian_sync_no_pending");
    return createSyncResult("idle", 0, permissionState);
  }

  const existingMarkdown = await readLogText();
  const fullMarkdown = mergeNotesIntoLog(
    pendingNotes,
    existingMarkdown,
    getMarkdownRenderOptions(),
  );

  await writeLogText(fullMarkdown);
  await markNotesWritten(pendingNotes.map((note) => note.id));
  await refreshBadge("obsidian_sync");

  await log("obsidian_append_succeeded", {
    count: pendingNotes.length,
    fileName: LOG_FILE_NAME,
    reason: normalizeReason(reason),
  });

  return createSyncResult("synced", pendingNotes.length, permissionState);
}

async function handleSyncWithoutPermission(permissionState, reason) {
  await log("obsidian_sync_needs_auth", {
    permissionState,
    reason: normalizeReason(reason),
    fileName: LOG_FILE_NAME,
  });
  await refreshBadge("obsidian_sync_needs_auth");

  return createSyncResult(
    permissionState === "unsupported" ? "unsupported" : "needsAuth",
    0,
    permissionState,
  );
}

function createSyncResult(status, count, permissionState) {
  return {
    ok: true,
    status,
    count,
    permissionState,
    fileName: LOG_FILE_NAME,
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
