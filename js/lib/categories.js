// js/lib/categories.js
// The project's expense "stages" as first-class categories with an icon key and
// a palette color token. This is frontend metadata only (never stored in the blob),
// so categories can be re-skinned without touching data. `color` maps to CSS custom
// properties defined in css/style.css (--cat-*). `icon` keys resolve in js/ui/icons.js.

export const CATEGORIES = [
  { id: 'Demolition Work',    label: 'Demolition Work',    icon: 'hammer',    color: '#ef4444' }, // red
  { id: 'Boring Labor',       label: 'Boring Labor',       icon: 'drill',     color: '#f59e0b' }, // amber
  { id: 'Boring Material',    label: 'Boring Material',    icon: 'pipe',      color: '#d97706' }, // amber-dark
  { id: 'Construction Labor', label: 'Construction Labor', icon: 'hardhat',   color: '#6366f1' }, // indigo
  { id: 'Building Material',  label: 'Building Material',  icon: 'brick',     color: '#0ea5e9' }, // sky
  { id: 'Sariya & Taar',      label: 'Sariya & Taar (Steel)', icon: 'rebar',  color: '#64748b' }, // slate
  { id: 'Cement',             label: 'Cement',             icon: 'bag',       color: '#78716c' }, // stone
  { id: 'Electrical',         label: 'Electrical',         icon: 'bolt',      color: '#eab308' }, // yellow
  { id: 'Plumbing',           label: 'Plumbing',           icon: 'wrench',    color: '#06b6d4' }, // cyan
  { id: 'Transportation',     label: 'Transportation',     icon: 'truck',     color: '#8b5cf6' }, // violet
  { id: 'Equipment',          label: 'Equipment',          icon: 'gear',      color: '#14b8a6' }, // teal
  { id: 'Food',               label: 'Food',               icon: 'food',      color: '#f97316' }, // orange
  { id: 'Miscellaneous',      label: 'Miscellaneous',      icon: 'dots',      color: '#94a3b8' }, // slate-light
];

const FALLBACK = { id: 'Miscellaneous', label: 'Miscellaneous', icon: 'dots', color: '#94a3b8' };

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Resolve a category by id, falling back to Miscellaneous for unknown values. */
export function getCategory(id) {
  return BY_ID.get(id) || { ...FALLBACK, id: id || FALLBACK.id, label: id || FALLBACK.label };
}

/** Category color (hex) for charts/badges. */
export function categoryColor(id) {
  return getCategory(id).color;
}

/** List of category ids in display order. */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Payment modes supported (superset including the owner's historical values). */
export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank', 'Online', 'Other'];
