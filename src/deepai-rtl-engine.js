/**
 * DeepAI Code Persian & RTL Enhancer Engine
 * Targeted: Formats chat conversation text and center-aligns hero heading,
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

  function isSidebarOrTab(el) {
    if (!el) return false;
    return !!(
      el.closest('aside') ||
      el.closest('nav') ||
      el.closest('[class*="sidebar"]') ||
      el.closest('[class*="Sidebar"]') ||
      el.closest('[class*="WorkspaceTabs"]')
    );
  }

  // Process text elements
  function processElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    if (isSidebarOrTab(el)) return;

    // Skip code blocks, pre tags, diffs, terminals, tables
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

    const isTextTag = ['p', 'li', 'blockquote', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
    if (!isTextTag) return;

    const text = el.innerText || el.textContent || '';
    if (!text || text.trim().length === 0) return;

    if (isRTLText(text)) {
      el.setAttribute('dir', 'rtl');
      el.classList.add('deepai-persian');
      if (tag === 'li' && el.parentElement) {
        el.parentElement.classList.add('deepai-persian');
        el.parentElement.setAttribute('dir', 'rtl');
      }
    } else {
      el.removeAttribute('dir');
      el.classList.remove('deepai-persian');
    }
  }

  function scanNode(root) {
    centerHeroTitle();
    if (!root) return;

    if (!isEnabled) {
      const tagged = (root.querySelectorAll ? root.querySelectorAll('.deepai-persian') : []);
      for (let i = 0; i < tagged.length; i++) {
        tagged[i].classList.remove('deepai-persian');
        tagged[i].removeAttribute('dir');
      }
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      processElement(root);
      const items = root.querySelectorAll ? root.querySelectorAll('p, li, blockquote, h2, h3, h4, h5, h6') : [];
      for (let i = 0; i < items.length; i++) {
        processElement(items[i]);
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
