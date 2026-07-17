const DATE_HEADING_PATTERN = /^##\s+(\d{6})\s*$/gm;

export function getDateKey(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function renderNotes(notes) {
  const groupedNotes = groupNotesByDate(sortNotes(notes));
  const sections = groupedNotes.map(([dateKey, dayNotes]) => {
    return renderDaySection(dateKey, dayNotes);
  });

  return sections.length > 0 ? `${sections.join("\n\n")}\n` : "";
}

export function renderNotesForAppend(notes, existingMarkdown = "") {
  const groupedNotes = groupNotesByDate(sortNotes(notes));

  if (groupedNotes.length === 0) {
    return "";
  }

  if (!existingMarkdown.trim()) {
    return renderNotes(notes);
  }

  const lastDateKey = findLastDateKey(existingMarkdown);
  const fragments = groupedNotes.map(([dateKey, dayNotes], index) => {
    if (index === 0 && dateKey === lastDateKey) {
      return dayNotes.map(renderNoteEntry).join("\n\n");
    }

    return renderDaySection(dateKey, dayNotes);
  });

  return `${appendSeparator(existingMarkdown)}${fragments.join("\n\n")}\n`;
}

export function renderDaySection(dateKey, notes) {
  const entries = notes.map(renderNoteEntry).join("\n\n");
  return `## ${dateKey}\n\n${entries}`;
}

export function renderNoteEntry(note) {
  const quote = renderQuotedOriginal(note.text);
  const comment = normalizeText(note.comment);
  const infoLine = renderInfoLine(note);
  const urlLine = `> ${normalizeText(note.url)}`;
  const sourceBlock = `${infoLine}\n${urlLine}`;

  if (!comment) {
    return `${quote}\n\n${sourceBlock}`;
  }

  return `${quote}\n\n我的评论:${comment}\n\n${sourceBlock}`;
}

function groupNotesByDate(notes) {
  const groups = new Map();

  for (const note of notes) {
    const dateKey = note.dateKey || getDateKey(new Date(note.ts));
    const group = groups.get(dateKey) || [];
    group.push(note);
    groups.set(dateKey, group);
  }

  return Array.from(groups.entries());
}

function sortNotes(notes) {
  return [...(notes || [])].sort((left, right) => {
    const leftTime = Date.parse(left.ts) || 0;
    const rightTime = Date.parse(right.ts) || 0;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return String(left.id).localeCompare(String(right.id));
  });
}

function renderQuotedOriginal(text) {
  const quotedText = `"${normalizeText(text)}"`;
  return quotedText
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function renderInfoLine(note) {
  const parts = [getSiteName(note.url)];
  const author = normalizeText(note.author);

  if (author) {
    parts.push(author);
  }

  parts.push(formatTime(note.ts));
  return `> [!info]- 来源:${parts.join(" · ")}`;
}

function getSiteName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "未知来源";
  } catch {
    return "未知来源";
  }
}

function formatTime(ts) {
  const date = new Date(ts);

  if (Number.isNaN(date.getTime())) {
    return "00:00";
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function findLastDateKey(markdown) {
  let lastMatch = null;
  let match = DATE_HEADING_PATTERN.exec(markdown);

  while (match) {
    lastMatch = match[1];
    match = DATE_HEADING_PATTERN.exec(markdown);
  }

  DATE_HEADING_PATTERN.lastIndex = 0;
  return lastMatch;
}

function appendSeparator(markdown) {
  if (markdown.endsWith("\n\n")) {
    return "";
  }

  if (markdown.endsWith("\n")) {
    return "\n";
  }

  return "\n\n";
}
