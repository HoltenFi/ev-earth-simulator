export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitForAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
