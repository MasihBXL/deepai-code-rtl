/**
 * DeepAI Code Persian & RTL Enhancer Engine
 * Targeted: Formats chat conversation text, lists, and quotes with proper RTL & BiDi isolation,
 * while strictly leaving the desktop UI layout, sidebar, tabs, and navigation intact.
 */
(function initDeepAIRTL() {
  if (window.__DEEPAI_RTL_INITIALIZED__) return;
  window.__DEEPAI_RTL_INITIALIZED__ = true;

  const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const STORAGE_KEY = 'deepai_rtl_enabled';

  let isEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';

  function isRTLText(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    return RTL_REGEX.test(trimmed);
  }

  // Ensure "What should we work on?" hero title is center-aligned
  function centerHeroTitle() {
    const headings = document.querySelectorAll('h1');
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      const text = h.textContent || '';
      if (text.includes('What should we') || text.includes('Choose a project') || text.includes('Add a project')) {
        h.style.setProperty('text-align', 'center', 'important');
        h.style.setProperty('width', '100%', 'important');
        h.style.setProperty('margin-left', 'auto', 'important');
        h.style.setProperty('margin-right', 'auto', 'important');
        h.style.setProperty('display', 'block', 'important');
      }
    }
  }

  // Strictly identify sidebar navigation or top tabs (NEVER match main chat)
  function isSidebarOrNav(el) {
    if (!el) return false;
    return !!(
      el.closest('aside') ||
      el.closest('nav') ||
      el.closest('[data-sidebar="sidebar"]') ||
      el.closest('[data-slot="sidebar"]') ||
      el.closest('[data-slot="sidebar-menu"]') ||
      el.closest('[class*="WorkspaceTabs"]') ||
      el.closest('header')
    );
  }

  function isChatContent(el) {
    if (!el) return false;
    return !!(
      el.closest('.chat-markdown') ||
      el.closest('[data-message-content]') ||
      el.closest('[data-message-role]') ||
      el.closest('[data-thread-find-text]') ||
      el.closest('.chat-content-lane') ||
      el.closest('div[data-slot="composer"]') ||
      el.closest('textarea') ||
      el.closest('input')
    );
  }

  // Isolate English punctuation inside Persian paragraphs to prevent BiDi inversion
  function isolateLatinPunctuation(el) {
    if (!el) return;
    // Do not alter streaming elements until streaming finishes
    if (el.closest('[data-streaming="true"]') || el.closest('[data-streaming=""]')) return;
    if (el.__latin_isolated__) return;
    el.__latin_isolated__ = true;

    try {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue) continue;
        const orig = node.nodeValue;
        // Match English words followed by punctuation before Persian characters or end of line
        const replaced = orig.replace(/([a-zA-Z0-9]+[.,!?:;)"'’»]+)(\s+[\u0600-\u06FF]|$)/g, '$1\u200E$2');
        if (replaced !== orig) {
          node.nodeValue = replaced;
        }
      }
    } catch (_) {}
  }

  // Process text elements
  function processElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    // Strictly skip sidebar, nav, and tabs unless inside chat
    if (isSidebarOrNav(el) && !isChatContent(el)) return;

    // Skip code blocks, pre tags, diffs, terminals, tables, SVGs
    const tag = el.tagName.toLowerCase();
    if (
      tag === 'pre' ||
      tag === 'code' ||
      tag === 'script' ||
      tag === 'style' ||
      tag === 'svg' ||
      el.closest('pre') ||
      el.closest('[class*="CodeBlock"]') ||
      el.closest('[class*="codeblock"]') ||
      el.closest('[class*="shiki"]') ||
      el.closest('[class*="diff"]') ||
      el.closest('[class*="terminal"]') ||
      el.closest('table')
    ) {
      return;
    }

    // Process prompt textarea / input
    if (tag === 'textarea' || tag === 'input' || el.isContentEditable) {
      const val = el.value || el.innerText || '';
      if (isEnabled && isRTLText(val)) {
        el.setAttribute('dir', 'rtl');
        el.classList.add('deepai-persian');
      } else {
        el.removeAttribute('dir');
        el.classList.remove('deepai-persian');
      }
      return;
    }

    const isTextTag = ['p', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span'].includes(tag);
    if (!isTextTag) return;

    // For div or span, only process if it is a direct leaf or message container
    if ((tag === 'div' || tag === 'span') && !el.classList.contains('chat-markdown') && !el.hasAttribute('data-message-content')) {
      if (el.querySelector('p, li, blockquote, h1, h2, h3, h4, h5, h6')) {
        return;
      }
    }

    const text = el.innerText || el.textContent || '';
    if (!text || text.trim().length === 0) return;

    if (isEnabled && isRTLText(text)) {
      el.setAttribute('dir', 'rtl');
      el.classList.add('deepai-persian');

      // If it's a list item, make sure parent ul/ol is also RTL
      if (tag === 'li' && el.parentElement) {
        el.parentElement.setAttribute('dir', 'rtl');
        el.parentElement.classList.add('deepai-persian');
      }

      // If it's .chat-markdown itself
      if (el.classList.contains('chat-markdown')) {
        el.setAttribute('dir', 'rtl');
      }

      isolateLatinPunctuation(el);
    } else {
      el.removeAttribute('dir');
      el.classList.remove('deepai-persian');
      delete el.__latin_isolated__;

      if (tag === 'li' && el.parentElement && !isRTLText(el.parentElement.innerText || '')) {
        el.parentElement.removeAttribute('dir');
        el.parentElement.classList.remove('deepai-persian');
      }
      if (el.classList.contains('chat-markdown') && !isRTLText(text)) {
        el.removeAttribute('dir');
      }
    }
  }

  function scanNode(root) {
    centerHeroTitle();
    if (!root) return;

    if (!isEnabled) {
      const tagged = root.querySelectorAll ? root.querySelectorAll('.deepai-persian, [dir="rtl"]') : [];
      for (let i = 0; i < tagged.length; i++) {
        const item = tagged[i];
        if (item.id === 'deepai-rtl-toggle-widget') continue;
        item.classList.remove('deepai-persian');
        item.removeAttribute('dir');
        delete item.__latin_isolated__;
      }
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      // Direct query for chat and composer targets
      const targets = root.querySelectorAll
        ? root.querySelectorAll(
            '.chat-markdown p, .chat-markdown li, .chat-markdown blockquote, .chat-markdown h1, .chat-markdown h2, .chat-markdown h3, .chat-markdown h4, .chat-markdown h5, .chat-markdown h6, [data-message-content] p, [data-message-content] li, [data-message-content] blockquote, [data-thread-find-text] p, [data-thread-find-text] li, textarea, input, [contenteditable="true"]'
          )
        : [];
      for (let i = 0; i < targets.length; i++) {
        processElement(targets[i]);
      }

      if (root.matches && (root.matches('p, li, blockquote, h1, h2, h3, h4, h5, h6, textarea, input') || root.isContentEditable)) {
        processElement(root);
      }
    }
  }

  // MutationObserver for real-time streaming AI responses
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        scanNode(document.body);
      });
    }
  });

  // Handle Input / Textarea typing in Prompt Composer
  function handleInputEvent(e) {
    const el = e.target;
    if (!el || (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT' && !el.isContentEditable)) return;

    const val = el.value || el.innerText || '';
    const trimmed = val.trim();
    if (!trimmed) {
      el.removeAttribute('dir');
      return;
    }

    if (RTL_REGEX.test(trimmed)) {
      el.setAttribute('dir', 'rtl');
    } else {
      el.setAttribute('dir', 'ltr');
    }
  }

  // Floating Toggle Widget
  let widget = null;
  function createWidget() {
    if (widget || !document.body) return;
    widget = document.createElement('div');
    widget.id = 'deepai-rtl-toggle-widget';
    widget.title = 'تغییر وضعیت فونت و راست‌چین فارسی (Ctrl+Shift+R)';
    widget.innerHTML = `<span class="indicator-dot"></span><span class="widget-label">RTL متن</span>`;

    widget.addEventListener('click', () => {
      toggleRTL();
    });

    document.body.appendChild(widget);
    updateWidget();
  }

  function updateWidget() {
    if (!widget) return;
    if (isEnabled) {
      widget.classList.add('rtl-active');
      widget.classList.remove('rtl-disabled');
      widget.querySelector('.widget-label').textContent = 'متن فعال RTL';
    } else {
      widget.classList.remove('rtl-active');
      widget.classList.add('rtl-disabled');
      widget.querySelector('.widget-label').textContent = 'متن غیرفعال RTL';
    }
  }

  function toggleRTL(state) {
    isEnabled = typeof state === 'boolean' ? state : !isEnabled;
    localStorage.setItem(STORAGE_KEY, isEnabled ? 'true' : 'false');
    updateWidget();
    scanNode(document.body);
  }

  // Hotkey: Ctrl + Shift + R
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      e.preventDefault();
      toggleRTL();
    }
  });

  document.addEventListener('input', handleInputEvent, true);

  function boot() {
    createWidget();
    centerHeroTitle();
    if (document.body) {
      scanNode(document.body);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
