// User feedback form, opened as a Tally popup.
// API reference: https://developers.tally.so/widgets/popups

const FEEDBACK_FORM_ID = "eqjbGO";

const TALLY_EMBED_SRC = "https://tally.so/widgets/embed.js";
const FEEDBACK_FORM_URL = `https://tally.so/r/${FEEDBACK_FORM_ID}`;
// The longest question needs 528px of content width; Tally adds 20px of page
// padding per side, so the popup wraps it below 568px.
const FEEDBACK_POPUP_WIDTH = 600;
const FEEDBACK_AUTO_CLOSE_MS = 3000;

type TallyPopupOptions = {
  layout?: "default" | "modal";
  width?: number;
  hideTitle?: boolean;
  overlay?: boolean;
  autoClose?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onSubmit?: () => void;
};

type TallyRuntime = {
  openPopup: (formId: string, options?: TallyPopupOptions) => void;
  closePopup: (formId: string) => void;
  loadEmbeds: () => void;
};

declare global {
  interface Window {
    Tally?: TallyRuntime;
  }
}

let embedScriptPromise: Promise<void> | null = null;

function loadTallyEmbed(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.Tally) {
    return Promise.resolve();
  }
  if (embedScriptPromise) {
    return embedScriptPromise;
  }

  embedScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TALLY_EMBED_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      embedScriptPromise = null;
      reject(new Error("Failed to load the Tally embed script"));
    });
    document.body.appendChild(script);
  });

  return embedScriptPromise;
}

/**
 * Opens the feedback form as a Tally modal popup. The embed script loads on
 * first use, so no third-party code runs until someone asks to give feedback.
 * If the script cannot load, the form opens in a new tab as a fallback.
 */
export async function openFeedbackForm(): Promise<void> {
  try {
    await loadTallyEmbed();
    if (!window.Tally) {
      throw new Error("Tally runtime unavailable after load");
    }
    window.Tally.openPopup(FEEDBACK_FORM_ID, {
      layout: "modal",
      width: FEEDBACK_POPUP_WIDTH,
      autoClose: FEEDBACK_AUTO_CLOSE_MS,
    });
  } catch {
    window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
  }
}
