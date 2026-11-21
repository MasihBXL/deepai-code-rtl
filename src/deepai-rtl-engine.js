/**
 * DeepAI Code Persian & RTL Enhancer Engine
 * Precision targeted: Formats chat conversation text and center-aligns hero heading,
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
        if (h.parentElement) {
          h.parentElement.style.setProperty('text-align', 'center', 'important');
          h.parentElement.style.setProperty('align-items', 'center', 'important');
          h.parentElement.style.setProperty('justify-content', 'center', 'important');
        }
      }
    }
  }

  // Fix neutral punctuation (periods, question marks, exclamation marks) attached to English words inside Persian text
  function fixBidiPunctuation(el) {
    if (!el || el.__bidiFixed) return;
    el.__bidiFixed = true;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const val = textNode.nodeValue;
      if (!val) continue;

      // When an English sentence ends with a period/exclamation mark before Persian text:
      // Append an invisible Left-to-Right Mark (\u200E) so the period stays with the English sentence
      if (/[a-zA-Z0-9][.!?][\s\n]+[\u0600-\u06FF]/.test(val)) {
        textNode.nodeValue = val.replace(/([a-zA-Z0-9][.!?])([\s\n]+[\u0600-\u06FF])/g, '$1\u200E$2');
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
      el.closest('[class*="WorkspaceTabs"]') ||
      el.closest('button')
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
      if (el.getAttribute('dir') !== 'rtl') {
        el.setAttribute('dir', 'rtl');
        el.classList.add('deepai-persian-text');
        fixBidiPunctuation(el);
      }
    } else {
      if (el.getAttribute('dir') === 'rtl') {
        el.removeAttribute('dir');
        el.classList.remove('deepai-persian-text');
      }
    }
  }

  function scanNode(root) {
    if (!isEnabled || !root) return;
    centerHeroTitle();

    if (root.nodeType === Node.ELEMENT_NODE) {
      processElement(root);
      const items = root.querySelectorAll('p, li, blockquote, h2, h3, h4, h5, h6');
      for (let i = 0; i < items.length; i++) {
        processElement(items[i]);
      }
    }
  }

  // MutationObserver for real-time streaming AI responses
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
    centerHeroTitle();
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
      document.querySelectorAll('.deepai-persian-text').forEach((el) => {
        el.classList.remove('deepai-persian-text');
        el.removeAttribute('dir');
        el.__bidiFixed = false;
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
