const STORAGE_KEY = "smart_email_templates";
const DEBOUNCE_MS = 200;

let templatesCache = [];
let dropdown = null;
let activeIndex = 0;
let activeCompose = null;
let currentMatches = [];

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function createElement(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text) el.textContent = options.text;
  if (options.html) el.innerHTML = options.html;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
  }
  return el;
}

async function loadTemplates() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  templatesCache = result[STORAGE_KEY] || [];
}

function ensureDropdown() {
  if (dropdown) return dropdown;
  dropdown = createElement("div", { className: "smart-template-dropdown" });
  Object.assign(dropdown.style, {
    position: "absolute",
    zIndex: 9999,
    minWidth: "220px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    padding: "6px",
    display: "none",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontSize: "13px"
  });
  document.body.appendChild(dropdown);
  return dropdown;
}

function hideDropdown() {
  if (!dropdown) return;
  dropdown.style.display = "none";
  dropdown.innerHTML = "";
  currentMatches = [];
  activeIndex = 0;
}

function getActiveSlashQuery(text, caretOffset) {
  const upToCaret = text.slice(0, caretOffset);
  const lastSlash = upToCaret.lastIndexOf("/");
  if (lastSlash === -1) return null;
  const afterSlash = upToCaret.slice(lastSlash + 1);
  if (afterSlash.includes(" ") || afterSlash.includes("\n")) return null;
  return { keyword: afterSlash, start: lastSlash };
}

function getCaretRect() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = range.getClientRects()[0];
  return rect || range.getBoundingClientRect();
}

function positionDropdown() {
  const rect = getCaretRect();
  if (!rect) return;
  const top = rect.bottom + window.scrollY + 6;
  const left = rect.left + window.scrollX;
  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;
}

function renderDropdown(matches) {
  ensureDropdown();
  dropdown.innerHTML = "";
  currentMatches = matches;
  activeIndex = 0;

  if (matches.length === 0) {
    hideDropdown();
    return;
  }

  matches.forEach((template, index) => {
    const item = createElement("div", { className: "smart-template-item" });
    item.textContent = `/${template.keyword} • ${template.title}`;
    Object.assign(item.style, {
      padding: "6px 8px",
      borderRadius: "6px",
      cursor: "pointer",
      background: index === activeIndex ? "#e5e7eb" : "transparent"
    });
    item.addEventListener("mouseenter", () => setActiveIndex(index));
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      insertTemplate(template);
    });
    dropdown.appendChild(item);
  });

  positionDropdown();
  dropdown.style.display = "block";
}

function setActiveIndex(index) {
  activeIndex = index;
  Array.from(dropdown.children).forEach((child, idx) => {
    child.style.background = idx === activeIndex ? "#e5e7eb" : "transparent";
  });
}

function getComposeTextAndOffset(composeEl) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!composeEl.contains(range.startContainer)) return null;

  const preRange = range.cloneRange();
  preRange.selectNodeContents(composeEl);
  preRange.setEnd(range.startContainer, range.startOffset);
  const text = preRange.toString();
  return { text, offset: text.length };
}

function replaceSlashCommand(composeEl, startOffset, endOffset, html) {
  composeEl.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(composeEl);

  let currentOffset = 0;
  let startNode = null;
  let startNodeOffset = 0;
  let endNode = null;
  let endNodeOffset = 0;

  const walker = document.createTreeWalker(composeEl, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeLength = node.textContent.length;
    if (startNode === null && currentOffset + nodeLength >= startOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }
    if (currentOffset + nodeLength >= endOffset) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }
    currentOffset += nodeLength;
  }

  if (!startNode || !endNode) return;

  const replaceRange = document.createRange();
  replaceRange.setStart(startNode, startNodeOffset);
  replaceRange.setEnd(endNode, endNodeOffset);
  replaceRange.deleteContents();

  const temp = document.createElement("div");
  temp.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (temp.firstChild) fragment.appendChild(temp.firstChild);
  replaceRange.insertNode(fragment);

  selection.removeAllRanges();
  selection.addRange(replaceRange);
}

function insertTemplate(template) {
  if (!activeCompose) return;
  const composeInfo = getComposeTextAndOffset(activeCompose);
  if (!composeInfo) return;
  const slash = getActiveSlashQuery(composeInfo.text, composeInfo.offset);
  if (!slash) return;
  const start = slash.start;
  const end = composeInfo.offset;
  replaceSlashCommand(activeCompose, start, end, template.content);
  hideDropdown();
}

const handleInput = debounce((event) => {
  const composeEl = event.target;
  if (!composeEl.isContentEditable) return;
  const composeInfo = getComposeTextAndOffset(composeEl);
  if (!composeInfo) return;
  const slash = getActiveSlashQuery(composeInfo.text, composeInfo.offset);
  if (!slash) {
    hideDropdown();
    return;
  }

  const keyword = slash.keyword.toLowerCase();
  const matches = templatesCache
    .filter((t) => t.keyword.toLowerCase().startsWith(keyword))
    .slice(0, 6);

  renderDropdown(matches);
}, DEBOUNCE_MS);

function handleKeydown(event) {
  if (!dropdown || dropdown.style.display === "none") return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveIndex((activeIndex + 1) % currentMatches.length);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveIndex((activeIndex - 1 + currentMatches.length) % currentMatches.length);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const template = currentMatches[activeIndex];
    if (template) insertTemplate(template);
  } else if (event.key === "Escape") {
    hideDropdown();
  }
}

function handleFocus(event) {
  if (!event.target.isContentEditable) return;
  activeCompose = event.target;
}

function bindEditor(editor) {
  if (editor.dataset.smartTemplateBound) return;
  editor.dataset.smartTemplateBound = "true";
  editor.addEventListener("input", handleInput);
  editor.addEventListener("keydown", handleKeydown);
  editor.addEventListener("focus", handleFocus);
}

function bindIframeEditor(iframe) {
  if (iframe.dataset.smartTemplateBound) return;
  iframe.dataset.smartTemplateBound = "true";
  const tryBind = () => {
    try {
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;
      const body = doc.body;
      if (body.dataset.smartTemplateBound) return;
      body.dataset.smartTemplateBound = "true";
      body.addEventListener("input", handleInput);
      body.addEventListener("keydown", handleKeydown);
      body.addEventListener("focus", handleFocus);
    } catch {
      // Cross-origin iframe; ignore.
    }
  };
  iframe.addEventListener("load", tryBind);
  tryBind();
}

function observeComposeAreas() {
  const observer = new MutationObserver(() => {
    const editors = document.querySelectorAll('[contenteditable="true"]');
    editors.forEach(bindEditor);

    const iframes = document.querySelectorAll("iframe");
    iframes.forEach(bindIframeEditor);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.smart_email_templates) {
    loadTemplates();
  }
});

loadTemplates();
observeComposeAreas();
