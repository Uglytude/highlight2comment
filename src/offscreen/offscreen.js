import { mergeNotesIntoLog } from "../lib/markdown.js";
import {
  getSavedDirectoryPermissionState,
  LOG_FILE_NAME,
  readLogText,
  writeLogText,
} from "../lib/obsidian-writer.js";

const WRITE_MESSAGE = "H2C_WRITE";
const OFFSCREEN_TARGET = "offscreen";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isOffscreenWriteMessage(message)) {
    return false;
  }

  handleWriteMessage(message).then(sendResponse);
  return true;
});

function isOffscreenWriteMessage(message) {
  return (
    message &&
    message.type === WRITE_MESSAGE &&
    message.target === OFFSCREEN_TARGET
  );
}

async function handleWriteMessage(message) {
  try {
    return await writeNotes(message);
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    console.warn("[highlight2comment:offscreen] write failed", errorMessage);

    return {
      ok: false,
      error: errorMessage,
    };
  }
}

async function writeNotes(message) {
  const permissionState = await getSavedDirectoryPermissionState();

  if (permissionState !== "granted") {
    console.info("[highlight2comment:offscreen] write skipped", {
      permissionState,
      fileName: LOG_FILE_NAME,
    });
    return createSyncResult(getUnavailableStatus(permissionState), 0, permissionState);
  }

  const pendingNotes = getMessageNotes(message);
  const existingMarkdown = await readLogText();
  const fullMarkdown = mergeNotesIntoLog(
    pendingNotes,
    existingMarkdown,
    message.renderOptions || {},
  );

  await writeLogText(fullMarkdown);

  console.info("[highlight2comment:offscreen] write succeeded", {
    count: pendingNotes.length,
    fileName: LOG_FILE_NAME,
  });

  return createSyncResult("synced", pendingNotes.length, permissionState);
}

function getMessageNotes(message) {
  return Array.isArray(message.notes) ? message.notes : [];
}

function getUnavailableStatus(permissionState) {
  return permissionState === "unsupported" ? "unsupported" : "needsAuth";
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

function getErrorMessage(error) {
  return error && error.message ? error.message : String(error);
}
