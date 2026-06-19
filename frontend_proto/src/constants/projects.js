// Project metadata vocabularies — kept in sync with the backend validators in
// backend/routes/projects.py (_VALID_STATUSES / _VALID_DOMAINS).

export const PROJECT_DOMAINS = ["Legal", "Medical", "Technical", "Marketing", "General"];

export const PROJECT_STATUSES = ["Draft", "Active", "In Review", "Completed", "Archived"];

// Status badge styling (dark theme, lime accent system).
export const STATUS_STYLES = {
  Draft:       "bg-[#1a1a1a] text-[#8c8c8b] border-[#262626]",
  Active:      "bg-[#1a2010] text-[#c5fe00] border-[#2a2e16]",
  "In Review": "bg-[#201c00] text-[#ffcc00] border-[#3a3000]",
  Completed:   "bg-[#101820] text-[#00c5fe] border-[#162030]",
  Archived:    "bg-[#1a0a0a] text-[#ff6b6b] border-[#3a1a1a]",
};

// Document stage → label + accent, used by the workspace document list.
export const STAGE_META = {
  uploaded:    { label: "Uploaded",    color: "#8c8c8b" },
  validating:  { label: "Validating",  color: "#ffcc00" },
  validated:   { label: "Validated",   color: "#00c5fe" },
  translating: { label: "Translating", color: "#ffcc00" },
  in_review:   { label: "In Review",   color: "#c500fe" },
  translated:  { label: "In Review",   color: "#c500fe" },
  approved:    { label: "Approved",    color: "#c5fe00" },
  exported:    { label: "Exported",    color: "#c5fe00" },
  error:       { label: "Error",       color: "#ff6b6b" },
};

export const STAGE_ORDER = [
  "uploaded", "validating", "validated", "translating", "in_review", "approved", "exported",
];

export function statusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.Draft;
}

export function stageMeta(stage) {
  return STAGE_META[stage] || STAGE_META.uploaded;
}
