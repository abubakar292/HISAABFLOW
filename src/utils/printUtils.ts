/**
 * Injects a print toolbar (hidden during actual printing) and auto-print script into bill HTML
 */
function buildPrintableDocument(html: string, title = 'Print Receipt'): string {
  const toolbarAndScript = `
    <style>
      @media print {
        .no-print-toolbar { display: none !important; }
        body { padding-top: 0 !important; }
      }
      .no-print-toolbar {
        position: sticky;
        top: 0;
        z-index: 9999;
        background: #522D60;
        color: #ffffff;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        margin: -12px -12px 16px -12px;
      }
      .no-print-toolbar-title {
        font-size: 13px;
        font-weight: 700;
      }
      .no-print-toolbar-actions {
        display: flex;
        gap: 8px;
      }
      .no-print-btn {
        border: none;
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .no-print-btn-primary {
        background: #ffffff;
        color: #522D60;
      }
      .no-print-btn-close {
        background: rgba(255,255,255,0.15);
        color: #ffffff;
      }
    </style>
    <div class="no-print-toolbar">
      <span class="no-print-toolbar-title">${title}</span>
      <div class="no-print-toolbar-actions">
        <button class="no-print-btn no-print-btn-primary" onclick="window.focus(); window.print();">Print Now</button>
        <button class="no-print-btn no-print-btn-close" onclick="window.close();">Close</button>
      </div>
    </div>
    <script>
      window.addEventListener('load', function() {
        setTimeout(function() {
          try {
            window.focus();
            window.print();
          } catch (e) {
            console.error(e);
          }
        }, 200);
      });
    </script>
  `;

  if (html.includes('<body')) {
    return html.replace(/<body[^>]*>/i, (match) => `${match}\n${toolbarAndScript}`);
  }
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body>${toolbarAndScript}${html}</body></html>`;
}

/**
 * Opens a top-level print window or uses same-origin iframe / DOM print fallback
 * so System Print works reliably inside sandboxed preview iframes, desktop browsers, and mobile PWAs.
 */
export function printInNewWindow(
  html: string,
  title = 'Print Receipt',
  iframeElement?: HTMLIFrameElement | null
): boolean {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // 1. If running inside an iframe (e.g. preview environment where allow-modals may be restricted),
  // open an unsandboxed top-level print window synchronously on user click.
  if (isInIframe) {
    try {
      const printWindow = window.open('', '_blank', 'width=850,height=900,menubar=yes,scrollbars=yes,resizable=yes');
      if (printWindow) {
        const enhancedHtml = buildPrintableDocument(html, title);
        printWindow.document.open();
        printWindow.document.write(enhancedHtml);
        printWindow.document.close();
        printWindow.focus();
        return true;
      }
    } catch (err) {
      console.warn('Popup print window failed, falling back to in-frame print:', err);
    }
  }

  // 2. Try printing via same-origin iframe if available
  if (iframeElement) {
    try {
      const doc = iframeElement.contentDocument || iframeElement.contentWindow?.document;
      const win = iframeElement.contentWindow;
      if (doc && win) {
        doc.open();
        doc.write(html);
        doc.close();

        let printTriggered = false;
        const onBeforePrint = () => {
          printTriggered = true;
        };
        win.addEventListener('beforeprint', onBeforePrint, { once: true });

        win.focus();
        win.print();

        // If running in an environment where win.print() was silently ignored by sandbox, open popup fallback
        if (!printTriggered && !isInIframe) {
          // Give browser a moment or return true as standard print call succeeded
          return true;
        }
        if (printTriggered) {
          return true;
        }
      }
    } catch (err) {
      console.warn('Iframe direct print failed:', err);
    }
  }

  // 3. Final fallback: open top-level window if not tried yet
  try {
    const fallbackWin = window.open('', '_blank');
    if (fallbackWin) {
      const enhancedHtml = buildPrintableDocument(html, title);
      fallbackWin.document.open();
      fallbackWin.document.write(enhancedHtml);
      fallbackWin.document.close();
      fallbackWin.focus();
      return true;
    }
  } catch (err) {
    console.warn('Fallback window open failed:', err);
  }

  // 4. Last resort: hidden same-origin iframe on document.body
  try {
    const hiddenFrame = document.createElement('iframe');
    hiddenFrame.style.position = 'fixed';
    hiddenFrame.style.right = '0';
    hiddenFrame.style.bottom = '0';
    hiddenFrame.style.width = '0';
    hiddenFrame.style.height = '0';
    hiddenFrame.style.border = '0';
    document.body.appendChild(hiddenFrame);

    const frameDoc = hiddenFrame.contentDocument || hiddenFrame.contentWindow?.document;
    const frameWin = hiddenFrame.contentWindow;
    if (frameDoc && frameWin) {
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();
      setTimeout(() => {
        frameWin.focus();
        frameWin.print();
        setTimeout(() => {
          if ( document.body.contains(hiddenFrame) ) {
            document.body.removeChild(hiddenFrame);
          }
        }, 2000);
      }, 150);
      return true;
    }
  } catch (err) {
    console.error('All print methods failed:', err);
  }

  return false;
}
