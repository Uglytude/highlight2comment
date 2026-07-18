export const LOG_FILE_NAME = "highlight2comment-log.md";

const DB_NAME = "highlight2comment";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const DIRECTORY_HANDLE_KEY = "obsidianDirectory";
const READ_WRITE_MODE = { mode: "readwrite" };

export function isFileSystemAccessSupported() {
  return (
    typeof window !== "undefined" &&
    "showDirectoryPicker" in window &&
    isSavedDirectoryAccessSupported()
  );
}

export async function authorizeDirectory() {
  assertPickerSupported();

  const savedDirectoryHandle = await getDirectoryHandle();
  const restoredDirectoryHandle = await restoreDirectoryPermission(savedDirectoryHandle);

  if (restoredDirectoryHandle) {
    return restoredDirectoryHandle;
  }

  return pickAndSaveDirectory();
}

export async function reauthorizeDirectory() {
  assertPickerSupported();
  return pickAndSaveDirectory();
}

export async function getConnectedDirectoryName() {
  if (!isFileSystemAccessSupported()) {
    return "";
  }

  const directoryHandle = await getDirectoryHandle();
  return directoryHandle ? directoryHandle.name : "";
}

export async function getDirectoryPermissionState() {
  if (!isFileSystemAccessSupported()) {
    return "unsupported";
  }

  return getSavedDirectoryPermissionState();
}

export async function getSavedDirectoryPermissionState() {
  if (!isSavedDirectoryAccessSupported()) {
    return "unsupported";
  }

  const directoryHandle = await getDirectoryHandle();

  if (!directoryHandle) {
    return "missing";
  }

  if (typeof directoryHandle.queryPermission !== "function") {
    return "unsupported";
  }

  return directoryHandle.queryPermission(READ_WRITE_MODE);
}

export async function readLogText() {
  const directoryHandle = await requireWritableDirectory();
  const fileHandle = await directoryHandle.getFileHandle(LOG_FILE_NAME, {
    create: true,
  });
  const file = await fileHandle.getFile();
  return file.text();
}

export async function writeLogText(fullText) {
  const directoryHandle = await requireWritableDirectory();
  const fileHandle = await directoryHandle.getFileHandle(LOG_FILE_NAME, {
    create: true,
  });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(String(fullText || ""));
    await writable.close();
  } catch (error) {
    await abortWritable(writable);
    throw error;
  }
}

async function abortWritable(writable) {
  if (typeof writable.abort !== "function") {
    return;
  }

  try {
    await writable.abort();
  } catch {
    // Preserve the original write/close error.
  }
}

async function pickAndSaveDirectory() {
  const directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  const permission = await requestWritePermission(directoryHandle);

  if (permission !== "granted") {
    throwWriterError("obsidianWritePermissionMissingError");
  }

  await saveDirectoryHandle(directoryHandle);
  await ensureLogFile(directoryHandle);
  return directoryHandle;
}

async function requireWritableDirectory() {
  assertSavedDirectoryAccessSupported();

  const directoryHandle = await getDirectoryHandle();

  if (!directoryHandle) {
    throwWriterError("obsidianFolderNotConnectedError");
  }

  if (typeof directoryHandle.queryPermission !== "function") {
    throwWriterError("fileSystemAccessUnsupportedError");
  }

  const permission = await directoryHandle.queryPermission(READ_WRITE_MODE);

  if (permission !== "granted") {
    throwWriterError("obsidianFolderNeedsReauthorizationError");
  }

  return directoryHandle;
}

async function ensureLogFile(directoryHandle) {
  await directoryHandle.getFileHandle(LOG_FILE_NAME, { create: true });
}

async function restoreDirectoryPermission(directoryHandle) {
  if (!directoryHandle) {
    return null;
  }

  try {
    const permission = await requestWritePermission(directoryHandle);

    if (permission === "granted") {
      await ensureLogFile(directoryHandle);
      return directoryHandle;
    }
  } catch {
    return null;
  }

  return null;
}

async function requestWritePermission(directoryHandle) {
  const currentPermission = await directoryHandle.queryPermission(READ_WRITE_MODE);

  if (currentPermission === "granted") {
    return currentPermission;
  }

  return directoryHandle.requestPermission(READ_WRITE_MODE);
}

async function getDirectoryHandle() {
  return getValue(DIRECTORY_HANDLE_KEY);
}

async function saveDirectoryHandle(directoryHandle) {
  await setValue(DIRECTORY_HANDLE_KEY, directoryHandle);
}

function assertPickerSupported() {
  if (!isFileSystemAccessSupported()) {
    throwWriterError("fileSystemAccessUnsupportedError");
  }
}

function assertSavedDirectoryAccessSupported() {
  if (!isSavedDirectoryAccessSupported()) {
    throwWriterError("fileSystemAccessUnsupportedError");
  }
}

function throwWriterError(messageKey) {
  throw new Error(messageKey);
}

function isSavedDirectoryAccessSupported() {
  return typeof indexedDB !== "undefined";
}

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error || createWriterError("indexedDbOpenFailedError"));
    };
  });
}

async function getValue(key) {
  return runStore("readonly", (store) => store.get(key));
}

async function setValue(key, value) {
  await runStore("readwrite", (store) => store.put(value, key));
}

async function runStore(mode, createRequest) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = createRequest(store);
    let result;

    request.onsuccess = () => {
      result = request.result;
    };

    request.onerror = () => {
      transaction.abort();
    };

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };

    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error || request.error || createWriterError("indexedDbOperationFailedError"),
      );
    };

    transaction.onabort = () => {
      database.close();
      reject(
        transaction.error || request.error || createWriterError("indexedDbOperationAbortedError"),
      );
    };
  });
}

function createWriterError(messageKey) {
  return new Error(messageKey);
}
