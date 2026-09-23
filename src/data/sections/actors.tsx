/**
 * The two people in every map, in colours used for nothing else: sky blue for
 * the robot, rose for the nurse. Prose uses these pills; the figures use the
 * same hues for the markers and their labels.
 */
import { type ReactNode } from "react";
import { InlineSpotColor } from "@/components/atoms";
import { getVariableInfo, spotColorPropsFromDefinition } from "../variables";

export const RobotWord = ({ children = "robot" }: { children?: ReactNode }) => (
    <InlineSpotColor varName="actorRobot" {...spotColorPropsFromDefinition(getVariableInfo('actorRobot'))}>
        {children}
    </InlineSpotColor>
);

export const NurseWord = ({ children = "nurse" }: { children?: ReactNode }) => (
    <InlineSpotColor varName="actorNurse" {...spotColorPropsFromDefinition(getVariableInfo('actorNurse'))}>
        {children}
    </InlineSpotColor>
);

/**
 * A live number in prose, styled like an InlineSpotColor pill but deliberately
 * NOT the editable component: the editor serialises a spot colour's text for
 * round-tripping, which would freeze a value that changes with the figures.
 * Colour comes from the lesson palette so it matches the quantity it reports.
 */
export const LivePill = ({ color, children }: { color: string; children: ReactNode }) => (
    <span
        className="inline-flex items-center rounded-md font-semibold leading-tight"
        style={{
            backgroundColor: color,
            color: "#1a1a2e",
            padding: "1px 6px",
            fontSize: "0.92em",
            letterSpacing: "0.01em",
            boxShadow: `0 1px 3px ${color}44`,
            fontVariantNumeric: "tabular-nums",
        }}
    >
        {children}
    </span>
);
