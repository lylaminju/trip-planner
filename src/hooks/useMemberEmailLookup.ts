import { useEffect, useState } from "react";

import { isValidEmail, normalizeEmail } from "@/lib/email";
import { lookupUserByEmail } from "@/lib/user-lookup-api";

export type MemberEmailLookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; username: string | null }
  | { status: "not-found" }
  | { status: "error" };

const LOOKUP_DEBOUNCE_MS = 400;

// Resolves a full, valid email to at most one account, debounced so we do not
// query on every keystroke. Only complete emails are ever sent to the server.
export function useMemberEmailLookup(email: string): MemberEmailLookup {
  const normalized = normalizeEmail(email);
  const [result, setResult] = useState<MemberEmailLookup>({ status: "idle" });

  useEffect(() => {
    if (!isValidEmail(normalized)) {
      setResult({ status: "idle" });
      return;
    }

    setResult({ status: "loading" });
    let active = true;
    const timer = setTimeout(() => {
      lookupUserByEmail(normalized)
        .then((data) => {
          if (!active) return;
          setResult(
            data.found
              ? { status: "found", username: data.username }
              : { status: "not-found" },
          );
        })
        .catch(() => {
          if (active) setResult({ status: "error" });
        });
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [normalized]);

  return result;
}
