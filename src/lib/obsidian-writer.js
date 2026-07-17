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
    typeof indexedDB !== "undefined"
  );
}

export async function authorizeDirectory() {
  assertSupported();

  const savedDirectoryHandle = await getDirectoryHandle();
  const restoredDirectoryHandle = await restoreDirectoryPermission(savedDirectoryHandle);

  if (restoredDirectoryHandle) {
    return restoredDirectoryHandle;
  }

  return pickAndSaveDirectory();
}

export async function reauthorizeDirectory() {
  assertSupported();
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

  const directoryHandle = await getDirectoryHandle();

  if (!directoryHandle) {
    return "missing";
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

export async function appendToLog(markdownText) {
  if (!String(markdownText || "").trim()) {
    return;
  }

  const directoryHandle = await requireWritableDirectory();
  const fileHandle = await directoryHandle.getFileHandle(LOG_FILE_NAME, {
    create: true,
  });
  const file = await fileHandle.getFile();
  const writable = await fileHandle.createWritable({ keepExistingData: true });

  try {
    await writable.seek(file.size);
    await writable.write(markdownText);
  } finally {
    await writable.close();
  }
}

async function pickAndSaveDirectory() {
  const directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  const permission = await requestWritePermission(directoryHandle);

  if (permission !== "granted") {
    throw new Error("没有获得 Obsidian 文件夹写入权限");
  }

  await saveDirectoryHandle(directoryHandle);
  await ensureLogFile(directoryHandle);
  return directoryHandle;
}

async function requireWritableDirectory() {
  assertSupported();

  const directoryHandle = await getDirectoryHandle();

  if (!directoryHandle) {
    throw new Error("还没有连接 Obsidian 文件夹");
  }

  const permission = await directoryHandle.queryPermission(READ_WRITE_MODE);

  if (permission !== "granted") {
    throw new Error("Obsidian 文件夹需要重新授权;本地笔记仍然保存在浏览器里");
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

function assertSupported() {
  if (!isFileSystemAccessSupported()) {
    throw new Error("当前浏览器不支持 File System Access API");
  }
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
    request.onerror = () => reject(request.error || new Error("IndexedDB 打开失败"));
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
      reject(transaction.error || request.error || new Error("IndexedDB 操作失败"));
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error || request.error || new Error("IndexedDB 操作中断"));
    };
  });
}
