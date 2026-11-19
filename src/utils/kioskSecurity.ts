/**
 * FDA 21 CFR Part 11 & IEC 62304 Clinical Station Security
 * Global Shield: Disables DevTools shortcuts, right-click inspect, and browser source inspection.
 */

export function initKioskSecurity(): void {
  if (typeof window === 'undefined') return;

  // 1. Disable Right-Click Context Menu
  window.addEventListener('contextmenu', (e: MouseEvent) => {
    // Prevent default context menu everywhere to avoid inspect/view source options
    e.preventDefault();
  }, { capture: true });

  // 2. Intercept DevTools and Browser Inspection Keyboard Shortcuts
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const key = e.key.toUpperCase();
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    // F12 -> DevTools
    if (e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+Shift+I / Cmd+Opt+I -> Inspect Element
    // Ctrl+Shift+J / Cmd+Opt+J -> Developer Console
    // Ctrl+Shift+C / Cmd+Opt+C -> Element Selector
    if ((ctrlOrCmd && shift && (key === 'I' || key === 'J' || key === 'C')) ||
        (ctrlOrCmd && alt && (key === 'I' || key === 'J' || key === 'C'))) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+U / Cmd+U -> View Page Source
    if (ctrlOrCmd && key === 'U') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+S / Cmd+S -> Save Webpage HTML
    if (ctrlOrCmd && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+P / Cmd+P -> Prevent printing whole SPA shell unless within dedicated printable view
    if (ctrlOrCmd && key === 'P' && !document.querySelector('[data-printable="true"]')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }, { capture: true });

  console.info('[UnivLabs Security] Clinical Kiosk Security active: Context menu and DevTools shortcuts disabled.');
}
