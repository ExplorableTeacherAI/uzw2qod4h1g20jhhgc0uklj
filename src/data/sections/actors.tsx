/**
 * The two people in every map, in their colours: the robot is indigo (every
 * "steps walked" count is measured from it) and the nurse is amber (every
 * guess is measured to her). Prose uses these pills; the figures use the same
 * hues for the markers and their labels.
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
