const CLIPBOARD_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
  </svg>
`;

const CHECK_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
`;

const $ = (id) => document.getElementById(id);

const inputWrapEl = $('input-wrap');
const inputEl = $('hymn-input');
const clearBtn = $('clear-btn');
const modeToggleBtn = $('mode-toggle-btn');
const suggestionsEl = $('suggestions');
const resultBoxEl = $('result-box');
const resultCollectionEl = $('result-collection');
const previewLinkEl = $('preview-link');
const copyBtn = $('copy-btn');
const statusMsgEl = $('status-msg');
const historySectionEl = $('history-section');
const historyListEl = $('history-list');

const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const numericPlaceholder = isDesktop ? '2 or The Spirit of God' : '2 or 1001';
const history = [];

let hymns = {};
let hymnList = [];
let currentHymn = null;

inputEl.placeholder = numericPlaceholder;
copyBtn.innerHTML = CLIPBOARD_ICON;

const formatLabel = (hymn) => `#${hymn.number} ${hymn.title}`;
const getCollection = (num) =>
  Number(num) <= 341 ? 'Hymns (1985)' : 'Hymns—For Home and Church';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function copyHymnLink(hymn, sourceEl = previewLinkEl) {
  const label = formatLabel(hymn);
  const html = `<a href="${escapeHtml(hymn.url)}">${escapeHtml(label)}</a>`;

  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([label], { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch {
      // Fall back to execCommand below
    }
  }

  const onCopy = (e) => {
    if (e.clipboardData) {
      e.clipboardData.setData('text/html', html);
      e.clipboardData.setData('text/plain', label);
      e.preventDefault();
    }
  };

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(sourceEl);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  document.addEventListener('copy', onCopy, { once: true });
  const ok = document.execCommand('copy');
  document.removeEventListener('copy', onCopy);
  selection?.removeAllRanges();
  return ok;
}

function setStatus(text = '', type) {
  statusMsgEl.textContent = text;
  statusMsgEl.className = type ? `status-msg is-${type}` : 'status-msg';
  statusMsgEl.hidden = !text;
}

function flashCopiedIcon(btn) {
  btn.innerHTML = CHECK_ICON;
  btn.classList.add('is-copied');
  window.setTimeout(() => {
    btn.innerHTML = CLIPBOARD_ICON;
    btn.classList.remove('is-copied');
  }, 1500);
}

function renderHistory() {
  historySectionEl.hidden = history.length === 0;
  historyListEl.replaceChildren(
    ...history.map((hymn) => {
      const li = el('li', 'history-item');
      const link = el('a', 'history-link', formatLabel(hymn));
      link.href = hymn.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      const btn = el('button', 'icon-copy-btn');
      btn.type = 'button';
      btn.innerHTML = CLIPBOARD_ICON;
      btn.setAttribute('aria-label', `Copy ${formatLabel(hymn)}`);
      btn.title = 'Copy to clipboard';
      btn.addEventListener('click', async () => {
        if (await copyHymnLink(hymn, link)) {
          flashCopiedIcon(btn);
          setStatus(`Copied ${formatLabel(hymn)}`, 'success');
        }
      });

      li.append(link, btn);
      return li;
    })
  );
}

function renderSuggestions(query) {
  const q = query.toLowerCase();
  const matches = hymnList.filter((h) => h.title.toLowerCase().includes(q)).slice(0, 6);

  if (matches.length === 0) {
    suggestionsEl.replaceChildren();
    suggestionsEl.hidden = true;
    setStatus(`No hymns matched "${query}".`, 'error');
    return;
  }

  suggestionsEl.replaceChildren(
    ...matches.map((hymn) => {
      const li = el('li');
      const btn = el('button', 'suggestion-btn');
      btn.type = 'button';

      const main = el('span', 'suggestion-main');
      main.append(
        el('span', 'suggestion-num', `#${hymn.number}`),
        el('span', 'suggestion-title', hymn.title)
      );

      btn.append(main, el('span', 'suggestion-source', getCollection(hymn.number)));
      btn.addEventListener('click', () => {
        inputEl.value = hymn.number;
        updateLookup();
        inputEl.focus();
      });

      li.append(btn);
      return li;
    })
  );
  suggestionsEl.hidden = false;
}

function updateLookup(keepStatus = false) {
  const raw = inputEl.value.trim();
  const normalized = raw.replace(/^#/, '');
  clearBtn.hidden = inputEl.value.length === 0;

  if (!keepStatus) setStatus();

  if (!raw) {
    currentHymn = null;
    resultBoxEl.hidden = true;
    suggestionsEl.hidden = true;
    return;
  }

  if (hymnList.length === 0) {
    return;
  }

  if (/^\d+$/.test(normalized)) {
    suggestionsEl.hidden = true;
    const key = String(parseInt(normalized, 10));
    const match = hymns[key];

    if (match) {
      currentHymn = { number: key, ...match };
      resultCollectionEl.textContent = getCollection(key);
      previewLinkEl.href = currentHymn.url;
      previewLinkEl.textContent = formatLabel(currentHymn);
      resultBoxEl.hidden = false;
    } else {
      currentHymn = null;
      resultBoxEl.hidden = true;
      setStatus(`Hymn #${normalized} not found.`, 'error');
    }
    return;
  }

  currentHymn = null;
  resultBoxEl.hidden = true;
  renderSuggestions(raw);
}

async function copyCurrentHymn() {
  if (!currentHymn) return;

  const copied = currentHymn;
  if (!(await copyHymnLink(copied))) {
    setStatus('Could not copy to clipboard.', 'error');
    return;
  }

  const idx = history.findIndex((item) => item.number === copied.number);
  if (idx !== -1) history.splice(idx, 1);
  history.unshift(copied);
  renderHistory();

  inputEl.value = '';
  updateLookup(true);
  setStatus(`Copied ${formatLabel(copied)}`, 'success');
  inputEl.focus();
}

inputEl.addEventListener('input', () => updateLookup());
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && currentHymn) {
    e.preventDefault();
    void copyCurrentHymn();
  }
});

clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  updateLookup();
  inputEl.focus();
});

copyBtn.addEventListener('click', () => {
  void copyCurrentHymn();
});

modeToggleBtn.addEventListener('click', () => {
  const nextTextMode = inputEl.inputMode !== 'text';
  inputEl.inputMode = nextTextMode ? 'text' : 'numeric';
  inputEl.placeholder = nextTextMode ? 'The Spirit of God' : numericPlaceholder;
  inputWrapEl.classList.toggle('is-text-mode', nextTextMode);

  modeToggleBtn.setAttribute('aria-pressed', String(nextTextMode));
  modeToggleBtn.textContent = nextTextMode ? '123' : 'Abc';
  const label = nextTextMode ? 'Switch to number keyboard' : 'Switch to text keyboard';
  modeToggleBtn.setAttribute('aria-label', label);
  modeToggleBtn.title = label;

  inputEl.blur();
  inputEl.focus();
});

async function loadHymns() {
  try {
    const res = await fetch('./src/data/hymns.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    hymns = await res.json();
    hymnList = Object.entries(hymns)
      .map(([number, entry]) => ({ number, ...entry }))
      .sort((a, b) => Number(a.number) - Number(b.number));
    if (inputEl.value.trim()) {
      updateLookup();
    }
  } catch {
    setStatus('Could not load hymn data.', 'error');
  }
}

void loadHymns();
