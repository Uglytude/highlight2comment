export const LOG_KEY = "h2c_logs";
const MAX_LOG_ENTRIES = 200;

export async function log(action, detail = {}) {
  const entry = {
    ts: new Date().toISOString(),
    action: String(action || "unknown"),
    detail: normalizeDetail(detail),
  };

  try {
    const data = await chrome.storage.local.get({ [LOG_KEY]: [] });
    const logs = Array.isArray(data[LOG_KEY]) ? data[LOG_KEY] : [];
    const nextLogs = [...logs, entry].slice(-MAX_LOG_ENTRIES);
    await chrome.storage.local.set({ [LOG_KEY]: nextLogs });
    console.info("[highlight2comment]", entry.action, entry.detail);
  } catch (error) {
    console.warn("[highlight2comment] logger failed", error);
  }
}

export async function getLogs() {
  const data = await chrome.storage.local.get({ [LOG_KEY]: [] });
  return Array.isArray(data[LOG_KEY]) ? data[LOG_KEY] : [];
}

function normalizeDetail(detail) {
  if (detail instanceof Error) {
    return {
      name: detail.name,
      message: detail.message,
    };
  }

  try {
    JSON.stringify(detail);
    return detail || {};
  } catch {
    return {
      message: String(detail),
    };
  }
}
