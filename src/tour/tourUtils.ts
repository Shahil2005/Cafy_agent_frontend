export function waitForElement(selector: string, timeout = 8000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const query = () => document.querySelector(selector);

    const existing = query();
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = query();
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timer = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Tour target not found: ${selector}`));
    }, timeout);
  });
}

export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 1024;
}

/** On small screens, anchor the add-job step to the submit button so the popover does not cover it. */
export function getTourHighlightSelector(step: { id: string; selector: string }): string {
  if (step.id === 'tracker-add-form' && isMobileViewport()) {
    return '[data-tour="add-job-submit"]';
  }
  return step.selector;
}

export function tourJobCardExists(selector: string): boolean {
  return Boolean(document.querySelector(selector));
}
