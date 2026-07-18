(() => {
  const SAVE_NOTE_MESSAGE = "H2C_SAVE_NOTE";
  const DISCONNECTED_MESSAGE = getMessage("extensionDisconnectedRefresh");
  const SAVE_FAILED_MESSAGE = getMessage("saveFailedStatus");
  const WIDGET_CLASS = "h2c-root";
  const ACTION_BUTTON_SIZE = 26;
  const ACTION_BAR_PADDING = 3;
  const ACTION_BAR_GAP = 2;
  const ACTION_BAR_WIDTH = ACTION_BUTTON_SIZE * 2 + ACTION_BAR_PADDING * 2 + ACTION_BAR_GAP;
  const ACTION_BAR_HEIGHT = ACTION_BUTTON_SIZE + ACTION_BAR_PADDING * 2;
  const WIDGET_GAP = 6;
  const BUTTON_APPEAR_DELAY_MS = 500;
  const EDITOR_WIDTH = 280;
  const EDITOR_HEIGHT = 46;
  const COMMENT_INPUT_MAX_HEIGHT = 88;
  const EDITOR_ERROR_DURATION_MS = 800;
  const HIGHLIGHT_ICON_SVG = `
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.2L6.35 11L12.5 4.75" fill="none" stroke="#202124" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
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
    if (isInsideWidget(event.target)) {
      return;
    }

    if (isEditableTarget(event.target)) {
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

    if (!isExtensionContextConnected()) {
      showDisconnectedMessage(buttonRect);
      return;
    }

    showButton(buttonRect);
  }

  function showButton(rect) {
    ensureButtonRoot();
    setButtonActionsVisible(buttonRoot, true);
    setButtonStatus("");
    positionButtonRoot(rect);
  }

  function showDisconnectedMessage(rect) {
    ensureButtonRoot();
    setButtonActionsVisible(buttonRoot, false);
    setButtonStatus(DISCONNECTED_MESSAGE);
    positionButtonRoot(rect);
  }

  function ensureButtonRoot() {
    if (buttonRoot) {
      return;
    }

    buttonRoot = createButton();
    document.documentElement.appendChild(buttonRoot);
  }

  function positionButtonRoot(rect) {
    const position = getButtonPosition(rect);
    buttonRoot.style.left = `${position.left}px`;
    buttonRoot.style.top = `${position.top}px`;
    buttonRoot.style.display = "block";
  }

  function hideButton() {
    window.clearTimeout(selectionTimer);
    selectionTimer = null;

    if (buttonRoot) {
      resetButtonRoot(buttonRoot);
      buttonRoot.style.display = "none";
    }
  }

  function createButton() {
    const root = document.createElement("div");
    root.className = WIDGET_CLASS;

    const actionBar = document.createElement("div");
    actionBar.className = "h2c-action-bar";
    actionBar.setAttribute("role", "toolbar");
    actionBar.setAttribute("aria-label", getMessage("selectionToolbarAria"));

    const highlightButton = createActionButton(
      getMessage("highlightOnlyAction"),
      HIGHLIGHT_ICON_SVG,
    );
    highlightButton.addEventListener("click", saveHighlightOnly);

    const commentButton = createActionButton(
      getMessage("addCommentAction"),
      COMMENT_ICON_SVG,
    );
    commentButton.addEventListener("click", openEditor);

    const status = document.createElement("div");
    status.className = "h2c-button-status";
    status.setAttribute("aria-live", "polite");

    actionBar.append(highlightButton, commentButton);
    root.append(actionBar, status);
    return root;
  }

  function createActionButton(label, iconSvg) {
    const button = document.createElement("button");
    button.className = "h2c-action-button";
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = iconSvg;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    return button;
  }

  async function saveHighlightOnly(event) {
    event.preventDefault();
    const button = event.currentTarget;

    if (!selectedText || !selectedRect || !button || button.disabled) {
      return;
    }

    if (!isExtensionContextConnected()) {
      setButtonStatus(DISCONNECTED_MESSAGE);
      return;
    }

    button.disabled = true;
    setButtonStatus("");

    try {
      const note = createNote(selectedText, "");
      await sendSaveNote(note);
      hideButton();
      window.getSelection().removeAllRanges();
    } catch (error) {
      button.disabled = false;
      setButtonStatus(error.message || String(error));
    }
  }

  function openEditor(event) {
    event.preventDefault();
    hideButton();

    if (!selectedText || !selectedRect) {
      return;
    }

    if (!isExtensionContextConnected()) {
      showDisconnectedMessage(selectedRect);
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
    editor.setAttribute("aria-label", getMessage("editorDialogLabel"));

    const capsule = document.createElement("div");
    capsule.className = "h2c-capsule";

    const textarea = document.createElement("textarea");
    textarea.className = "h2c-textarea";
    textarea.placeholder = getMessage("commentPlaceholder");
    textarea.rows = 1;
    textarea.setAttribute("aria-label", getMessage("commentPlaceholder"));
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
    button.setAttribute("aria-label", getMessage("saveAction"));
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

    if (!isExtensionContextConnected()) {
      setEditorStatus(root, DISCONNECTED_MESSAGE);
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
      if (!isExtensionContextConnected()) {
        reject(new Error(DISCONNECTED_MESSAGE));
        return;
      }

      try {
        chrome.runtime.sendMessage(
          {
            type: SAVE_NOTE_MESSAGE,
            note,
          },
          (response) => {
            const runtimeError = getRuntimeLastError();

            if (runtimeError) {
              reject(new Error(getSaveErrorMessage(runtimeError)));
              return;
            }

            if (!response || !response.ok) {
              reject(
                new Error(getSaveErrorMessage(response ? response.error : SAVE_FAILED_MESSAGE)),
              );
              return;
            }

            resolve(response);
          },
        );
      } catch (error) {
        reject(new Error(getSaveErrorMessage(error)));
      }
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

  function setButtonStatus(message) {
    if (!buttonRoot) {
      return;
    }

    const status = buttonRoot.querySelector(".h2c-button-status");

    if (status) {
      status.textContent = message;
    }
  }

  function resetButtonRoot(root) {
    const status = root.querySelector(".h2c-button-status");
    const buttons = root.querySelectorAll(".h2c-action-button");

    setButtonActionsVisible(root, true);

    if (status) {
      status.textContent = "";
    }

    for (const button of buttons) {
      button.disabled = false;
    }
  }

  function setButtonActionsVisible(root, visible) {
    const actionBar = root.querySelector(".h2c-action-bar");

    if (actionBar) {
      actionBar.style.display = visible ? "" : "none";
    }
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
    const preferredLeft = rect.right + WIDGET_GAP;
    const fallbackLeft = rect.left - ACTION_BAR_WIDTH - WIDGET_GAP;
    const maxLeft = window.innerWidth - ACTION_BAR_WIDTH - 8;
    const left = preferredLeft <= maxLeft ? preferredLeft : fallbackLeft;
    const centerTop = rect.top + (rect.height - ACTION_BAR_HEIGHT) / 2;

    return {
      left: clamp(left, 8, maxLeft),
      top: clamp(centerTop, 8, window.innerHeight - ACTION_BAR_HEIGHT - 8),
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

  function getRuntimeLastError() {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime) {
        return { message: DISCONNECTED_MESSAGE };
      }

      return chrome.runtime.lastError;
    } catch {
      return { message: DISCONNECTED_MESSAGE };
    }
  }

  function getSaveErrorMessage(error) {
    const message = error && error.message ? error.message : String(error);

    if (isExtensionContextInvalidMessage(message) || !isExtensionContextConnected()) {
      return DISCONNECTED_MESSAGE;
    }

    return message;
  }

  function isExtensionContextInvalidMessage(message) {
    return String(message || "").includes("Extension context invalidated");
  }

  function isExtensionContextConnected() {
    try {
      return (
        typeof chrome !== "undefined" &&
        Boolean(chrome.runtime && chrome.runtime.id) &&
        typeof chrome.runtime.sendMessage === "function"
      );
    } catch {
      return false;
    }
  }

  function getMessage(key, substitutions = []) {
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
      // Return the key so missing i18n fails visibly.
    }

    return key;
  }
})();
