/**
 * DeepAI Code Persian & RTL Enhancer Engine
 * Targeted: Enhances chat message readability and Persian typography
 * while strictly leaving the UI layout, sidebar, tabs, and navigation intact.
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

  // Process ONLY elements inside the chat conversation
  function processElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    // Strictly skip sidebar, navigation, tabs, titlebar, modals, menus
    if (
      el.closest('aside') ||
      el.closest('nav') ||
      el.closest('[class*="sidebar"]') ||
      el.closest('[class*="Sidebar"]') ||
      el.closest('[class*="WorkspaceTabs"]') ||
      el.closest('[class*="tab"]') ||
      el.closest('[class*="Tab"]') ||
      el.closest('[class*="header"]') ||
      el.closest('[class*="Header"]') ||
      el.closest('[class*="titlebar"]') ||
      el.closest('[class*="project"]')
    ) {
      return;
    }

    // Skip code blocks, pre tags, and terminals
    const tag = el.tagName.toLowerCase();
    if (
      tag === 'pre' ||
      tag === 'code' ||
      tag === 'script' ||
      tag === 'style' ||
      tag === 'svg' ||
      tag === 'textarea' ||
      tag === 'input' ||
      el.closest('pre') ||
      el.closest('[class*="CodeBlock"]') ||
      el.closest('[class*="shiki"]') ||
      el.closest('[class*="diff"]') ||
      el.closest('[class*="terminal"]') ||
      el.closest('table')
    ) {
      return;
    }

    // Only process text elements inside chat messages (.chat-markdown or message rows)
    const isInsideChat = el.closest('.chat-markdown') || el.closest('.chat-content-lane') || el.closest('.messages-timeline-row-frame');
    if (!isInsideChat) return;

    const isTextTag = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(tag);
    if (!isTextTag) return;

    const text = el.innerText || el.textContent || '';
    if (!text || text.trim().length === 0) return;

    if (isRTLText(text)) {
      if (el.getAttribute('dir') !== 'rtl') {
        el.setAttribute('dir', 'rtl');
        el.classList.add('deepai-persian-block');
      }
    } else {
      if (el.getAttribute('dir') === 'rtl') {
        el.removeAttribute('dir');
        el.classList.remove('deepai-persian-block');
      }
    }
  }

  function scanNode(root) {
    if (!isEnabled || !root) return;
    if (root.nodeType !== Node.ELEMENT_NODE) return;

    const chatContainers = root.matches && (root.matches('.chat-markdown, .chat-content-lane, .messages-timeline-row-frame'))
      ? [root]
      : (root.querySelectorAll ? root.querySelectorAll('.chat-markdown, .chat-content-lane, .messages-timeline-row-frame') : []);

    for (let c = 0; c < chatContainers.length; c++) {
      const items = chatContainers[c].querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote');
      for (let i = 0; i < items.length; i++) {
        processElement(items[i]);
      }
    }
  }

  // MutationObserver with debounce for real-time AI streaming
  let scheduled = false;
  const nodesToProcess = new Set();

  function flushNodes() {
    scheduled = false;
    if (!isEnabled) {
      nodesToProcess.clear();
      return;
    }
    nodesToProcess.forEach((node) => {
      scanNode(node);
    });
    nodesToProcess.clear();
  }

  const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const added of mutation.addedNodes) {
          if (added.nodeType === Node.ELEMENT_NODE) {
            nodesToProcess.add(added);
          }
        }
      } else if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent) nodesToProcess.add(parent);
      }
    }
    if (!scheduled && nodesToProcess.size > 0) {
      scheduled = true;
      requestAnimationFrame(flushNodes);
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
      widget.querySelector('.widget-label').textContent = 'RTL متن فعال';
    } else {
      widget.classList.remove('rtl-active');
      widget.classList.add('rtl-disabled');
      widget.querySelector('.widget-label').textContent = 'RTL متن غیرفعال';
    }
  }

  function toggleRTL(state) {
    isEnabled = typeof state === 'boolean' ? state : !isEnabled;
    localStorage.setItem(STORAGE_KEY, isEnabled ? 'true' : 'false');
    updateWidget();
    if (isEnabled) {
      scanNode(document.body);
    } else {
      document.querySelectorAll('.deepai-persian-block').forEach((el) => {
        el.classList.remove('deepai-persian-block');
        el.removeAttribute('dir');
      });
    }
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
