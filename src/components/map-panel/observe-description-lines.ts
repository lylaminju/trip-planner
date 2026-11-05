export function observeDescriptionLines(
  viewport: HTMLElement,
  description: HTMLElement,
): () => void {
  let disposed = false;

  function measure() {
    if (disposed) return;

    const availableHeight = viewport.getBoundingClientRect().height;
    const lineHeight = Number.parseFloat(
      getComputedStyle(description).lineHeight,
    );
    let lines = 0;

    if (
      Number.isFinite(availableHeight) &&
      Number.isFinite(lineHeight) &&
      lineHeight > 0
    ) {
      lines = Math.max(0, Math.floor(availableHeight / lineHeight));
    }

    description.style.setProperty(
      "--map-selected-card-note-lines",
      String(Math.max(1, lines)),
    );
    description.style.visibility = lines > 0 ? "visible" : "hidden";
  }

  const observer = new ResizeObserver(measure);
  // The clamped text must not determine the size of its observed viewport.
  observer.observe(viewport);
  const fonts = description.ownerDocument.fonts;
  fonts?.addEventListener("loadingdone", measure);
  measure();

  return () => {
    disposed = true;
    observer.disconnect();
    fonts?.removeEventListener("loadingdone", measure);
  };
}
