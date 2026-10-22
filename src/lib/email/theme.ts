/**
 * Email colors and type, in one place, matching the site (src/app/globals.css). Email clients ignore CSS
 * variables and web fonts are unreliable, so these are plain values and a system font stack.
 */
export const EMAIL_THEME = {
  paper: "#FFFFFF",
  canvas: "#F4F5F2",
  ink: "#16211C",
  muted: "#55605A",
  rule: "#E3E6E1",
  accent: "#1F5A43",
  accentInk: "#FFFFFF",
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
} as const;
