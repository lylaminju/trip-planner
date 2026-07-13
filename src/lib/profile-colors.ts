export type ProfileColor = {
  id: string;
  hex: string;
  label: string;
};

export const PROFILE_COLORS: ProfileColor[] = [
  { id: "teal", hex: "#0f766e", label: "Teal" },
  { id: "indigo", hex: "#4f46e5", label: "Indigo" },
  { id: "violet", hex: "#7c3aed", label: "Violet" },
  { id: "rose", hex: "#e11d48", label: "Rose" },
  { id: "amber", hex: "#d97706", label: "Amber" },
  { id: "emerald", hex: "#059669", label: "Emerald" },
  { id: "sky", hex: "#0284c7", label: "Sky" },
  { id: "slate", hex: "#475569", label: "Slate" },
];

export const DEFAULT_PROFILE_COLOR = PROFILE_COLORS[0].hex;

export function isValidProfileColor(hex: unknown): hex is string {
  return (
    typeof hex === "string" &&
    PROFILE_COLORS.some((color) => color.hex === hex)
  );
}
