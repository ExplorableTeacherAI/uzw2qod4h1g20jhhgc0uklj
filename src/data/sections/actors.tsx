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
