/**
 * One colour per quantity, used by every figure, formula and prose pill in the
 * lesson. The three hues are the three terms of A*'s score:
 *
 *   f  =  g  +  h
 *  teal  indigo  amber
 *
 * g — steps already walked from the robot (what the blind search orders by)
 * h — the guess of steps still to go to the nurse (what the guess-walk orders by)
 * f — the total, and everything A* does with it
 */

export const WALKED = "#8E90F5";
export const WALKED_TEXT = "#5B5FD9";
export const WALKED_BG = "rgba(142, 144, 245, 0.22)";

export const GUESS = "#F7B23B";
export const GUESS_TEXT = "#C27803";
export const GUESS_BG = "rgba(247, 178, 59, 0.22)";

export const TOTAL = "#62D0AD";
export const TOTAL_TEXT = "#1F9E78";
export const TOTAL_BG = "rgba(98, 208, 173, 0.22)";

/**
 * The two people get hues of their own, used for nothing else, so "robot" never
 * reads as "steps walked" and "nurse" never reads as "the guess":
 * sky blue for the robot, rose for the nurse.
 */
export const ROBOT_FILL = "#62CCF9";
export const ROBOT_EDGE = "#1E8FC2";
export const NURSE_RING = "#F8A0CD";
export const NURSE_TEXT = "#C4508F";

/** Student answers and definitions — deliberately none of the three quantity hues. */
export const ANSWER = "#2563EB";
export const ANSWER_BG = "rgba(37, 99, 235, 0.12)";

export const INK = "#334155";
export const INK_STRUCTURE = "#64748B";
export const INK_QUIET = "#CBD5E1";
export const WALL_FILL = "#475569";

export const FORMULA_COLORS = { f: TOTAL, g: WALKED, h: GUESS } as const;

export const EASE_150 = {
    transition: "opacity 150ms ease, stroke-width 150ms ease, fill-opacity 150ms ease",
} as const;

/** White outline behind small labels so they stay legible over shaded squares. */
export const LABEL_OUTLINE = {
    paintOrder: "stroke",
    stroke: "#FFFFFF",
    strokeWidth: 3,
    strokeLinejoin: "round",
} as const;
