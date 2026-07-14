/* ============================================================================
   Tailwind theme tokens the game UI depends on.
   ----------------------------------------------------------------------------
   The React UI (Leaderboard.tsx, and some HUD/menus in ArisGame.tsx) uses these
   CUSTOM color classes: text-bone, bg-bone, bg-glow, text-glow, bg-ink,
   text-ink, border-ink, bg-ink-soft, etc.

   In a stock Tailwind install those classes resolve to NOTHING and the menus
   render colorless. Merge the block below into Lester's Arcade's
   tailwind.config — under `theme.extend` — so the classes resolve.

   Only `ink`, `bone`, and `glow` are actually referenced by the game today;
   the others (blue/mint/blood) are included for completeness in case you pull
   in more of the original UI later. Drop them if you want a minimal footprint.

   NOTE: the CANVAS game needs NONE of this — all in-game art uses hardcoded hex
   (see src/game/config.ts COLORS) and system-ui text. This is purely for the
   HTML/React overlay UI.

   If the arcade does NOT use Tailwind, translate these to plain CSS, or restyle
   the ~40 utility classes in Leaderboard.tsx to the arcade's design system.
   ============================================================================ */

module.exports = {
  theme: {
    extend: {
      colors: {
        // ── Used by the game UI ──────────────────────────────
        ink:  { DEFAULT: "#0A0A0F", soft: "#14141C" },  // dark panels / text
        bone: { DEFAULT: "#F5F3EF", soft: "#EDEBE4" },  // off-white text / fills
        glow: { DEFAULT: "#2EE862", soft: "#5CFF85", deep: "#1FB84D" }, // green accent

        // ── Not currently used by the game; included for completeness ──
        blue:  { DEFAULT: "#2B5FAD", dark: "#1E4480", light: "#4A7BC8" },
        mint:  { DEFAULT: "#C5F5E4", dark: "#A8E8D1" },
        blood: { DEFAULT: "#C41E3A", light: "#FF8095" },
      },
    },
  },
};
