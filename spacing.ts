/**
 * PRIMARY spacing tokens - the core visual scale steps.
 * 
 * These represent the minimal, authoritative spacing scale used throughout the app.
 * All other spacing values are accessible via semantic layout aliases in layout.ts.
 * 
 * Rationale:
 * - zero: Essential for explicit no-spacing cases
 * - tiny (4): Very small spacing for tight relationships (section titles, headers)
 * - xs (6): Small spacing for compact components and small gaps
 * - sm (8): Standard small spacing - most common for component gaps and padding
 * - base (12): Base spacing unit - most common for block padding and margins
 * - xl (16): Large spacing - standard screen padding and major component padding
 * - section (20): Section-level spacing for major visual breaks
 * - huge (24): Huge spacing for major transitions and scroll content bottoms
 * 
 * DO NOT add new values - use layout aliases for specific use cases.
 */
export const spacing = {
  zero: 0,      // no spacing
  tiny: 4,      // very small spacing (section titles, headers)
  xs: 6,        // small spacing (compact components, small gaps)
  sm: 8,        // standard small spacing (component gaps, vertical padding)
  base: 12,     // base spacing unit (block padding, margins)
  xl: 16,       // large spacing (screen padding, major components)
  section: 20,  // section-level spacing (major visual breaks)
  huge: 24,     // huge spacing (major transitions, scroll bottoms)
} as const;


