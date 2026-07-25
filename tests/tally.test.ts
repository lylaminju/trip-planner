import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FEEDBACK_FORM_ID = "eqjbGO";
const FEEDBACK_FORM_URL = `https://tally.so/r/${FEEDBACK_FORM_ID}`;

type MutableGlobal = {
  window?: unknown;
  document?: unknown;
};

describe("openFeedbackForm", () => {
  beforeEach(() => {
    // Reset the module so the memoized embed-script promise does not leak
    // between the success and fallback cases.
    vi.resetModules();
  });

  afterEach(() => {
    delete (globalThis as MutableGlobal).window;
    delete (globalThis as MutableGlobal).document;
  });

  it("opens the feedback form as a Tally modal popup when the runtime is ready", async () => {
    const openPopup = vi.fn();
    (globalThis as MutableGlobal).window = {
      Tally: { openPopup, closePopup: vi.fn(), loadEmbeds: vi.fn() },
    };

    const { openFeedbackForm } = await import("@/lib/tally");
    await openFeedbackForm();

    expect(openPopup).toHaveBeenCalledTimes(1);
    expect(openPopup).toHaveBeenCalledWith(
      FEEDBACK_FORM_ID,
      expect.objectContaining({ layout: "modal" }),
    );
  });

  it("falls back to opening the form in a new tab when the embed cannot load", async () => {
    const open = vi.fn();
    // No Tally runtime and no document, so loading the embed script fails.
    (globalThis as MutableGlobal).window = { open };

    const { openFeedbackForm } = await import("@/lib/tally");
    await openFeedbackForm();

    expect(open).toHaveBeenCalledWith(
      FEEDBACK_FORM_URL,
      "_blank",
      "noopener,noreferrer",
    );
  });
});
