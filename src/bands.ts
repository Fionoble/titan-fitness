// Shared resistance-band color palette (presets shown in Equipment config;
// custom-named colors fall back to neutral styling)
export const PRESET_BAND_COLORS = [
  { name: 'Yellow', color: '#EAB308' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Green', color: '#22C55E' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Black', color: '#374151' },
  { name: 'Purple', color: '#A855F7' },
  { name: 'Orange', color: '#F97316' },
];

export const BAND_COLOR_MAP: Record<string, string> = Object.fromEntries(
  PRESET_BAND_COLORS.map((p) => [p.name, p.color])
);
