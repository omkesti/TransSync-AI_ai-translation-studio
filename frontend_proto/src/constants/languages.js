export const TARGET_LANGUAGES = [
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "es", label: "Spanish (LATAM)" },
  { code: "fr", label: "French" },
  { code: "hi", label: "Hindi" },
  { code: "mar", label: "Marathi" },
];

export function languageLabel(code) {
  if (!code) return "—";
  const match = TARGET_LANGUAGES.find((l) => l.code === code);
  return match ? match.label : code;
}
