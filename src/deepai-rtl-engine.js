/**
 * DeepAI Code Persian & RTL Enhancer Engine
 * Injects bi-directional text fixes, Vazirmatn font, and automatic RTL detection.
 */
(function initDeepAIRTL() {
  if (window.__DEEPAI_RTL_INITIALIZED__) return;
  window.__DEEPAI_RTL_INITIALIZED__ = true;

  // Regex matching Arabic/Persian/Hebrew characters
  const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const STORAGE_KEY = 'deepai_rtl_enabled';

  let isEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';

  function applyRootClass() {
    if (isEnabled) {
      document.documentElement.classList.add('deepai-rtl-enabled');
      document.body && document.body.classList.add('deepai-rtl-enabled');
    } else {
      document.documentElement.classList.remove('deepai-rtl-enabled');
      document.body && document.body.classList.remove('deepai-rtl-enabled');
    }
    updateWidget();
  }

  // Determine if a string is primarily RTL or starts with RTL
  function isRTLText(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Check first 150 non-whitespace characters for early strong direction
    const sample = trimmed.slice(0, 150);
    return RTL_REGEX.test(sample);
  }

  // Tag an element as RTL if it contains Persian/Arabic
  function processElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    // Skip code blocks, preformatted text, diff viewers, and script/style tags
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

    // Check relevant content elements
    const isCandidateTag = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'span', 'div'].includes(tag);
    if (!isCandidateTag) return;

    // Only process elements that contain direct text or are leaf-like text wrappers
    const text = el.innerText || el.textContent || '';
    if (!text || text.length < 2) return;

    if (isRTLText(text)) {
      if (!el.classList.contains('deepai-rtl-block')) {
        el.classList.add('deepai-rtl-block');
        el.setAttribute('dir', 'rtl');
      }
    } else {
      if (el.classList.contains('deepai-rtl-block')) {
        el.classList.remove('deepai-rtl-block');
        el.removeAttribute('dir');
      }
    }
  }

  // Scan a DOM subtree for text elements
  function scanNode(node) {
    if (!isEnabled) return;
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    processElement(node);
    const children = node.querySelectorAll ? node.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, div') : [];
    for (let i = 0; i < children.length; i++) {
      processElement(children[i]);
    }
  }

  // Setup MutationObserver for streaming AI responses and dynamic DOM changes
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

  // Handle Input / Textarea typing
  function handleInputEvent(e) {
    const el = e.target;
    if (!el || (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT' && !el.isContentEditable)) return;

    const val = el.value || el.innerText || '';
    const trimmed = val.trim();
    if (!trimmed) {
      el.removeAttribute('dir');
      return;
    }

    if (RTL_REGEX.test(trimmed[0]) || RTL_REGEX.test(trimmed.slice(0, 30))) {
      el.setAttribute('dir', 'rtl');
      el.classList.add('deepai-rtl-input');
    } else {
      el.setAttribute('dir', 'ltr');
      el.classList.remove('deepai-rtl-input');
    }
  }

  // Floating Toggle Widget
  let widget = null;
  function createWidget() {
    if (widget || !document.body) return;
    widget = document.createElement('div');
    widget.id = 'deepai-rtl-toggle-widget';
    widget.title = 'تغییر وضعیت RTL و فونت فارسی (Ctrl+Shift+R)';
    widget.innerHTML = `<span class="indicator-dot"></span><span class="widget-label">RTL فارسی</span>`;

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
      widget.querySelector('.widget-label').textContent = 'RTL فعال';
    } else {
      widget.classList.remove('rtl-active');
      widget.classList.add('rtl-disabled');
      widget.querySelector('.widget-label').textContent = 'RTL غیرفعال';
    }
  }

  function toggleRTL(state) {
    isEnabled = typeof state === 'boolean' ? state : !isEnabled;
    localStorage.setItem(STORAGE_KEY, isEnabled ? 'true' : 'false');
    applyRootClass();
    if (isEnabled) {
      scanNode(document.body);
    } else {
      document.querySelectorAll('.deepai-rtl-block').forEach((el) => {
        el.classList.remove('deepai-rtl-block');
        el.removeAttribute('dir');
      });
    }
  }

  // Setup Keyboard Shortcut: Ctrl + Shift + R
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      e.preventDefault();
      toggleRTL();
    }
  });

  // Attach input listeners
  document.addEventListener('input', handleInputEvent, true);
  document.addEventListener('keyup', handleInputEvent, true);

  // Initialize
  function boot() {
    applyRootClass();
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
