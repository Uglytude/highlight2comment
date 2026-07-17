(() => {
  const SAVE_NOTE_MESSAGE = "H2C_SAVE_NOTE";
  const WIDGET_CLASS = "h2c-root";
  const BUTTON_WIDTH = 28;
  const BUTTON_HEIGHT = 28;
  const BUTTON_GAP = 6;
  const BUTTON_APPEAR_DELAY_MS = 500;
  const EDITOR_WIDTH = 280;
  const EDITOR_HEIGHT = 46;
  const COMMENT_INPUT_MAX_HEIGHT = 88;
  const EDITOR_ERROR_DURATION_MS = 800;
  const COMMENT_ICON_SVG = `
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4.25 3.75H11.75C12.85 3.75 13.75 4.65 13.75 5.75V9.25C13.75 10.35 12.85 11.25 11.75 11.25H8L4.75 13.25V11.25H4.25C3.15 11.25 2.25 10.35 2.25 9.25V5.75C2.25 4.65 3.15 3.75 4.25 3.75Z" fill="none" stroke="#202124" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  const SAVE_ICON_SVG = `
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M3 7.15L5.7 9.75L11 4.25" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  let buttonRoot = null;
  let editorRoot = null;
  let outsideEditorTimer = null;
  let isOutsideEditorListenerAttached = false;
  let selectionTimer = null;
  let selectedText = "";
  let selectedRect = null;

  document.addEventListener("mouseup", handleSelectionTrigger, true);
  document.addEventListener("keyup", handleSelectionTrigger, true);
  document.addEventListener("selectionchange", scheduleSelectionCheck);
  window.addEventListener("scroll", hideButton, true);
  window.addEventListener("resize", hideButton);

  function handleSelectionTrigger(event) {
    if (isInsideWidget(event.target) || isEditableTarget(event.target)) {
      hideButton();
      return;
    }

    scheduleSelectionCheck();
  }

  function scheduleSelectionCheck() {
    window.clearTimeout(selectionTimer);

    if (shouldHideButtonImmediately()) {
      hideButton();
      return;
    }

    selectionTimer = window.setTimeout(updateSelection, BUTTON_APPEAR_DELAY_MS);
  }

  function shouldHideButtonImmediately() {
    const selection = window.getSelection();

    return !selection || selection.rangeCount === 0 || !selection.toString().trim();
  }

  function updateSelection() {
    if (editorRoot || isEditableTarget(document.activeElement)) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      hideButton();
      return;
    }

    const text = selection.toString().trim();

    if (!text) {
      hideButton();
      return;
    }

    const rect = getSelectionRect(selection);
    const buttonRect = getSelectionEndRect(selection);

    if (!rect || !buttonRect) {
      hideButton();
      return;
    }

    selectedText = text;
    selectedRect = rect;
    showButton(buttonRect);
  }

  function showButton(rect) {
    if (!buttonRoot) {
      buttonRoot = createButton();
      document.documentElement.appendChild(buttonRoot);
    }

    const position = getButtonPosition(rect);
    buttonRoot.style.left = `${position.left}px`;
    buttonRoot.style.top = `${position.top}px`;
    buttonRoot.style.display = "block";
  }

  function hideButton() {
    window.clearTimeout(selectionTimer);
    selectionTimer = null;

    if (buttonRoot) {
      buttonRoot.style.display = "none";
    }
  }

  function createButton() {
    const root = document.createElement("div");
    root.className = WIDGET_CLASS;

    const button = document.createElement("button");
    button.className = "h2c-button";
    button.type = "button";
    button.setAttribute("aria-label", "加评论");
    button.title = "加评论";
    button.innerHTML = COMMENT_ICON_SVG;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", openEditor);

    root.appendChild(button);
    return root;
  }

  function openEditor(event) {
    event.preventDefault();
    hideButton();

    if (!selectedText || !selectedRect) {
      return;
    }

    closeEditor();
    editorRoot = createEditor();
    document.documentElement.appendChild(editorRoot);

    const position = getWidgetPosition(selectedRect, EDITOR_WIDTH, EDITOR_HEIGHT, false);
    editorRoot.style.left = `${position.left}px`;
    editorRoot.style.top = `${position.top}px`;

    const textarea = editorRoot.querySelector(".h2c-textarea");
    resizeCommentInput(textarea);
    textarea.focus();
    scheduleOutsideEditorListener();
  }

  function createEditor() {
    const root = document.createElement("div");
    root.className = WIDGET_CLASS;

    const editor = document.createElement("div");
    editor.className = "h2c-editor";
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-label", "添加评论");

    const capsule = document.createElement("div");
    capsule.className = "h2c-capsule";

    const textarea = document.createElement("textarea");
    textarea.className = "h2c-textarea";
    textarea.placeholder = "写一句评论";
    textarea.rows = 1;
    textarea.setAttribute("aria-label", "写一句评论");
    textarea.addEventListener("input", () => handleEditorInput(root, textarea));
    textarea.addEventListener("keydown", (event) => handleEditorKeyDown(event, root));

    const saveButton = createSaveButton();
    saveButton.addEventListener("click", () => saveCurrentNote(root));

    const status = document.createElement("div");
    status.className = "h2c-status";
    status.setAttribute("aria-live", "polite");

    capsule.append(textarea, saveButton);
    editor.append(capsule, status);
    root.appendChild(editor);
    return root;
  }

  function createSaveButton() {
    const button = document.createElement("button");
    button.className = "h2c-save-button";
    button.type = "button";
    button.setAttribute("aria-label", "保存");
    button.innerHTML = SAVE_ICON_SVG;
    return button;
  }

  function handleEditorInput(root, textarea) {
    resizeCommentInput(textarea);
    setEditorStatus(root, "");
  }

  function handleEditorKeyDown(event, root) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      saveCurrentNote(root);
    }
  }

  function resizeCommentInput(textarea) {
    const capsule = textarea.closest(".h2c-capsule");

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, COMMENT_INPUT_MAX_HEIGHT)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > COMMENT_INPUT_MAX_HEIGHT ? "auto" : "hidden";

    if (capsule) {
      capsule.classList.toggle("h2c-tall", textarea.scrollHeight > 32);
    }
  }

  async function saveCurrentNote(root) {
    const textarea = root.querySelector(".h2c-textarea");
    const saveButton = root.querySelector(".h2c-save-button");
    const comment = textarea.value.trim();

    if (saveButton.disabled) {
      return;
    }

    if (!comment) {
      showTemporaryEditorError(root);
      return;
    }

    saveButton.disabled = true;
    setEditorStatus(root, "");

    try {
      const note = createNote(selectedText, comment);
      await sendSaveNote(note);
      closeEditor();
      window.getSelection().removeAllRanges();
    } catch (error) {
      saveButton.disabled = false;
      setEditorStatus(root, error.message || String(error));
    }
  }

  function showTemporaryEditorError(root) {
    const capsule = root.querySelector(".h2c-capsule");

    if (!capsule) {
      return;
    }

    capsule.classList.add("h2c-error");
    window.setTimeout(() => {
      const status = root.querySelector(".h2c-status");

      if (status && !status.textContent) {
        capsule.classList.remove("h2c-error");
      }
    }, EDITOR_ERROR_DURATION_MS);
  }

  function sendSaveNote(note) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: SAVE_NOTE_MESSAGE,
          note,
        },
        (response) => {
          const runtimeError = chrome.runtime.lastError;

          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }

          if (!response || !response.ok) {
            reject(new Error(response ? response.error : "保存失败"));
            return;
          }

          resolve(response);
        },
      );
    });
  }

  function createNote(text, comment) {
    const now = new Date();

    return {
      id: `${now.getTime().toString(36)}-${randomShortString()}`,
      text,
      comment,
      url: window.location.href,
      title: document.title || "",
      author: getPageAuthor(),
      ts: now.toISOString(),
      dateKey: getDateKey(now),
    };
  }

  function getPageAuthor() {
    const selectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="article:author"]',
      'meta[property="og:article:author"]',
      'meta[name="twitter:creator"]',
    ];

    for (const selector of selectors) {
      const content = readMetaContent(selector);

      if (content) {
        return content;
      }
    }

    return "";
  }

  function readMetaContent(selector) {
    const element = document.querySelector(selector);
    return element ? String(element.getAttribute("content") || "").trim() : "";
  }

  function getDateKey(date) {
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  function randomShortString() {
    return Math.random().toString(36).slice(2, 8);
  }

  function closeEditor() {
    removeOutsideEditorListener();

    if (editorRoot) {
      editorRoot.remove();
      editorRoot = null;
    }
  }

  function scheduleOutsideEditorListener() {
    window.clearTimeout(outsideEditorTimer);
    outsideEditorTimer = window.setTimeout(() => {
      outsideEditorTimer = null;

      if (editorRoot) {
        addOutsideEditorListener();
      }
    }, 0);
  }

  function addOutsideEditorListener() {
    if (isOutsideEditorListenerAttached) {
      return;
    }

    document.addEventListener("mousedown", handleOutsideEditorMouseDown, true);
    isOutsideEditorListenerAttached = true;
  }

  function removeOutsideEditorListener() {
    window.clearTimeout(outsideEditorTimer);
    outsideEditorTimer = null;

    if (!isOutsideEditorListenerAttached) {
      return;
    }

    document.removeEventListener("mousedown", handleOutsideEditorMouseDown, true);
    isOutsideEditorListenerAttached = false;
  }

  function handleOutsideEditorMouseDown(event) {
    if (isInsideWidget(event.target)) {
      return;
    }

    closeEditor();
  }

  function setEditorStatus(root, message) {
    const status = root.querySelector(".h2c-status");
    const capsule = root.querySelector(".h2c-capsule");

    if (!status || !capsule) {
      return;
    }

    status.textContent = message;
    capsule.classList.toggle("h2c-error", Boolean(message));
  }

  function getSelectionRect(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (isVisibleRect(rect)) {
      return rect;
    }

    for (const candidate of range.getClientRects()) {
      if (isVisibleRect(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  function getSelectionEndRect(selection) {
    const range = selection.getRangeAt(0);
    let lastRect = null;

    for (const candidate of range.getClientRects()) {
      if (isVisibleRect(candidate)) {
        lastRect = candidate;
      }
    }

    return lastRect;
  }

  function isVisibleRect(rect) {
    return rect.width > 0 || rect.height > 0;
  }

  function getButtonPosition(rect) {
    const preferredLeft = rect.right + BUTTON_GAP;
    const fallbackLeft = rect.left - BUTTON_WIDTH - BUTTON_GAP;
    const maxLeft = window.innerWidth - BUTTON_WIDTH - 8;
    const left = preferredLeft <= maxLeft ? preferredLeft : fallbackLeft;
    const centerTop = rect.top + (rect.height - BUTTON_HEIGHT) / 2;

    return {
      left: clamp(left, 8, maxLeft),
      top: clamp(centerTop, 8, window.innerHeight - BUTTON_HEIGHT - 8),
    };
  }

  function getWidgetPosition(rect, width, height, aboveSelection) {
    const preferredTop = aboveSelection ? rect.top - height - 8 : rect.bottom + 8;
    const fallbackTop = aboveSelection ? rect.bottom + 8 : rect.top - height - 8;
    const left = clamp(rect.left, 8, window.innerWidth - width - 8);
    const top = clamp(preferredTop, 8, window.innerHeight - height - 8);

    if (Math.abs(top - preferredTop) > 2) {
      return {
        left,
        top: clamp(fallbackTop, 8, window.innerHeight - height - 8),
      };
    }

    return { left, top };
  }

  function clamp(value, min, max) {
    if (max < min) {
      return min;
    }

    return Math.min(Math.max(value, min), max);
  }

  function isInsideWidget(target) {
    return Boolean(target instanceof Element && target.closest(`.${WIDGET_CLASS}`));
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();
    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target.isContentEditable ||
      Boolean(target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]'))
    );
  }
})();
