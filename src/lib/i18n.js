export function getMessage(key, substitutions = []) {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.i18n &&
      typeof chrome.i18n.getMessage === "function"
    ) {
      const message = chrome.i18n.getMessage(key, substitutions);

      if (message) {
        return message;
      }
    }
  } catch {
    // Fall through to the key so callers still fail visibly.
  }

  return key;
}
