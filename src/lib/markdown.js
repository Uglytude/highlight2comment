const DATE_HEADING_PATTERN = /^##\s+(\d{6})\s*$/gm;
const ENTRY_NUMBER_PATTERN = /^\*\*(\d+)\.\*\*\s*$/gm;
const FOOTNOTE_DEFINITION_LINE_PATTERN = /^\[\^[^\]]+\]:/;
const DEFAULT_COMMENT_PREFIX = "评:";
const DEFAULT_UNKNOWN_SOURCE_LABEL = "未知来源";

export function getDateKey(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function renderNotes(notes, options = {}) {
  const renderOptions = normalizeRenderOptions(options);
  const groupedNotes = groupNotesByDate(sortNotes(notes));
  const sections = groupedNotes.map(([dateKey, dayNotes]) => {
    return renderDaySection(dateKey, dayNotes, renderOptions);
  });

  return sections.length > 0 ? `${sections.join("\n\n")}\n` : "";
}

export function mergeNotesIntoLog(notes, existingMarkdown = "", options = {}) {
  const renderOptions = normalizeRenderOptions(options);
  const logText = String(existingMarkdown || "");
  const groupedNotes = groupNotesByDate(sortNotes(notes));

  if (groupedNotes.length === 0) {
    return logText;
  }

  if (!logText.trim()) {
    return renderNotes(notes, renderOptions);
  }

  const lastSection = findLastDaySection(logText);

  if (!lastSection) {
    return appendRenderedSections(logText, groupedNotes, renderOptions);
  }

  let mergedMarkdown = logText;
  const groupsToAppend = [];

  for (const [dateKey, dayNotes] of groupedNotes) {
    if (dateKey === lastSection.dateKey) {
      mergedMarkdown = insertNotesIntoLastDaySection(
        logText,
        lastSection,
        dayNotes,
        renderOptions,
      );
      continue;
    }

    groupsToAppend.push([dateKey, dayNotes]);
  }

  if (groupsToAppend.length === 0) {
    return mergedMarkdown;
  }

  return appendRenderedSections(mergedMarkdown, groupsToAppend, renderOptions);
}

export function renderDaySection(dateKey, notes, options = {}) {
  const renderOptions = normalizeRenderOptions(options);
  const entries = renderNoteEntries(notes, 1, renderOptions);
  const footnotes = renderFootnoteDefinitions(notes, renderOptions);
  return `## ${dateKey}\n\n${entries}\n\n${footnotes}`;
}

export function renderNoteEntry(note, entryNumber = 1, options = {}) {
  const renderOptions = normalizeRenderOptions(options);
  const quote = renderQuotedOriginal(note.text, getFootnoteLabel(note));
  const comment = normalizeText(note.comment);

  if (!comment) {
    return `**${entryNumber}.**\n\n${quote}`;
  }

  return `**${entryNumber}.**\n\n${quote}\n\n${renderOptions.commentPrefix}${comment}`;
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

function renderNoteEntries(notes, startNumber, options) {
  return notes
    .map((note, index) => renderNoteEntry(note, startNumber + index, options))
    .join("\n\n");
}

function renderFootnoteDefinitions(notes, options) {
  return notes.map((note) => renderFootnoteDefinition(note, options)).join("\n");
}

function renderQuotedOriginal(text, footnoteLabel) {
  const lines = normalizeText(text).split("\n");
  const lastIndex = lines.length - 1;

  return lines
    .map((line, index) => {
      const openingQuote = index === 0 ? "\"" : "";
      const closingQuote = index === lastIndex ? `"[^${footnoteLabel}]` : "";
      return `${openingQuote}${line}${closingQuote}`;
    })
    .map((line) => `> ${line}`)
    .join("\n");
}

function renderFootnoteDefinition(note, options) {
  const parts = [getSiteName(note.url, options)];
  const author = normalizeText(note.author);

  if (author) {
    parts.push(author);
  }

  parts.push(formatTime(note.ts));
  parts.push(normalizeText(note.url));
  return `[^${getFootnoteLabel(note)}]: ${parts.join(" · ")}`;
}

function getFootnoteLabel(note) {
  const label = normalizeText(note.id);

  if (!label) {
    throw new Error("note.id is required for markdown footnotes");
  }

  return label;
}

function appendRenderedSections(markdown, groupedNotes, options) {
  const sections = groupedNotes.map(([dateKey, dayNotes]) => {
    return renderDaySection(dateKey, dayNotes, options);
  });

  return `${markdown}${appendSeparator(markdown)}${sections.join("\n\n")}\n`;
}

function insertNotesIntoLastDaySection(markdown, section, notes, options) {
  const nextNumber = findMaxEntryNumber(section.text) + 1;
  const newEntries = renderNoteEntries(notes, nextNumber, options);
  const newFootnotes = renderFootnoteDefinitions(notes, options);
  const footnoteBlock = findTrailingFootnoteBlock(section.text);

  if (!footnoteBlock) {
    const insertion = `${appendSeparator(markdown)}${newEntries}\n\n${newFootnotes}`;
    return `${markdown.slice(0, section.end)}${insertion}${markdown.slice(section.end)}`;
  }

  const footnoteStart = section.start + footnoteBlock.start;
  const footnoteEnd = section.start + footnoteBlock.end;
  const entrySeparator = appendSeparator(markdown.slice(0, footnoteStart));
  const entryInsertion = `${entrySeparator}${newEntries}\n\n`;
  const footnoteInsertion = `\n${newFootnotes}`;

  return (
    markdown.slice(0, footnoteStart) +
    entryInsertion +
    markdown.slice(footnoteStart, footnoteEnd) +
    footnoteInsertion +
    markdown.slice(footnoteEnd)
  );
}

function findTrailingFootnoteBlock(sectionText) {
  const lines = getLineRanges(sectionText);
  let lastContentIndex = lines.length - 1;

  while (lastContentIndex >= 0 && lines[lastContentIndex].text.trim() === "") {
    lastContentIndex -= 1;
  }

  if (
    lastContentIndex < 0 ||
    !FOOTNOTE_DEFINITION_LINE_PATTERN.test(lines[lastContentIndex].text)
  ) {
    return null;
  }

  let firstFootnoteIndex = lastContentIndex;

  while (
    firstFootnoteIndex > 0 &&
    FOOTNOTE_DEFINITION_LINE_PATTERN.test(lines[firstFootnoteIndex - 1].text)
  ) {
    firstFootnoteIndex -= 1;
  }

  return {
    start: lines[firstFootnoteIndex].start,
    end: lines[lastContentIndex].end,
  };
}

function getLineRanges(text) {
  const lines = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n") {
      continue;
    }

    lines.push({
      text: text.slice(start, index),
      start,
      end: index,
    });
    start = index + 1;
  }

  lines.push({
    text: text.slice(start),
    start,
    end: text.length,
  });
  return lines;
}

function findMaxEntryNumber(markdown) {
  let maxNumber = 0;

  for (const match of markdown.matchAll(ENTRY_NUMBER_PATTERN)) {
    maxNumber = Math.max(maxNumber, Number(match[1]));
  }

  return maxNumber;
}

function findLastDaySection(markdown) {
  const matches = Array.from(markdown.matchAll(DATE_HEADING_PATTERN));

  if (matches.length === 0) {
    return null;
  }

  const match = matches[matches.length - 1];

  return {
    dateKey: match[1],
    start: match.index,
    end: markdown.length,
    text: markdown.slice(match.index),
  };
}

function getSiteName(url, options) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || options.unknownSourceLabel;
  } catch {
    return options.unknownSourceLabel;
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

function appendSeparator(markdown) {
  if (markdown.endsWith("\n\n")) {
    return "";
  }

  if (markdown.endsWith("\n")) {
    return "\n";
  }

  return "\n\n";
}

function normalizeRenderOptions(options = {}) {
  return {
    commentPrefix: String(options.commentPrefix || DEFAULT_COMMENT_PREFIX),
    unknownSourceLabel: String(options.unknownSourceLabel || DEFAULT_UNKNOWN_SOURCE_LABEL),
  };
}
