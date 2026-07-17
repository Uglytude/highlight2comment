import { log } from "./logger.js";
import { getPendingCount } from "./storage.js";

const BADGE_BACKGROUND_COLOR = "#5f6368";

export async function refreshBadge(reason) {
  try {
    const count = await getPendingCount();
    const text = formatBadgeText(count);

    await chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR });
    await chrome.action.setBadgeText({ text });
    await log("badge_updated", {
      count,
      reason,
      text,
    });
  } catch (error) {
    await log("badge_update_failed", {
      message: getErrorMessage(error),
      reason,
    });
  }
}

function formatBadgeText(count) {
  if (count <= 0) {
    return "";
  }

  if (count > 99) {
    return "99+";
  }

  return String(count);
}

function getErrorMessage(error) {
  return error && error.message ? error.message : String(error);
}
