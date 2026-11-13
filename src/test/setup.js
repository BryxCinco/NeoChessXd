import '@testing-library/jest-dom';

// Node 22+ ships its own experimental `localStorage` global, which is
// undefined unless Node is started with --localstorage-file — and it hides
// the one jsdom provides. Point the globals back at jsdom's storage so the
// app code under test sees a normal browser localStorage.
const dom = globalThis.jsdom;
if (dom) {
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get: () => dom.window[name],
    });
  }
}
