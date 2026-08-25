import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph, InlineTooltip } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

export const aGuessWorthHavingBlocks: ReactElement[] = [
    <StackLayout key="layout-heuristic-heading" maxWidth="xl">
        <Block id="heuristic-heading" padding="md">
            <EditableH2 id="h2-heuristic-heading" blockId="heuristic-heading">
                A Guess Worth Having
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-worked-example" maxWidth="xl">
        <Block id="heuristic-worked-example" padding="sm">
            <EditableParagraph id="para-heuristic-worked-example" blockId="heuristic-worked-example">
                The robot does know one thing it was not using: where the nurse is. Even with walls in the way,
                it can guess the distance still to go by counting squares as if the floor were completely empty,
                across and then up. From a square four columns and three rows away from her, that guess is
                4 + 3 = 7.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-definition" maxWidth="xl">
        <Block id="heuristic-definition" padding="sm">
            <EditableParagraph id="para-heuristic-definition" blockId="heuristic-definition">
                That number is called a{" "}
                <InlineTooltip
                    id="tooltip-heuristic-definition"
                    tooltip="A cheap estimate of the distance still to travel, calculated without looking at the walls. It must never overshoot the true remaining distance."
                >
                    heuristic
                </InlineTooltip>
                : a cheap estimate that is never allowed to overshoot the true remaining distance. Walls can
                only make the real journey longer, never shorter, so counting across-and-up is always safe.
                Ranking squares by that guess alone gives a search that dives straight at the nurse, and it can
                settle for a route that is not the shortest.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-visual" maxWidth="xl">
        <Block id="heuristic-visual">
            <VisualOptionCards
                blockId="heuristic-visual"
                cards={[
                    {
                        id: "walk-by-guess",
                        title: "A floor grid where students walk the robot themselves, one square at a time, using only the guesses",
                        looks: "Imagine the floor plan with the guess printed on each square next to the robot, counting how many steps to the nurse across empty floor. The robot leaves a coloured trail behind it as it moves, and a wall forms a dead-end pocket between it and her.",
                        manipulate: "Click a neighbouring square to step the robot onto it, always choosing the smallest guess, until the trail reaches the nurse or runs out of room",
                        reveals: "Following the guess alone marches the robot straight into the dead end, because a small guess says nothing about the walls in between",
                        paradigm: "goal",
                        recommended: true,
                    },
                    {
                        id: "guess-landscape",
                        title: "A floor grid where every square carries its own guess of the distance left to the nurse",
                        looks: "Imagine the room with a small number printed in every open square: the steps it would take to reach the nurse across empty floor. The numbers shade from pale beside her to deep in the far corners, so the whole room reads like a slope running downhill towards her.",
                        manipulate: "Drag the nurse onto another square and watch every number on the map recount itself around her new position",
                        reveals: "The guess is nothing but distance measured on an empty floor, and from anywhere in the room it points downhill towards the goal",
                        paradigm: "conventional",
                    },
                    {
                        id: "walls-never-shorten",
                        title: "A floor grid where the guesses stay put no matter where students build walls",
                        looks: "Imagine the room with a guess printed in each open square and the true shortest route drawn from the robot to the nurse as a thin line. Students can drop walls anywhere, and the real route bends around them and gets longer while the printed numbers stay exactly as they were.",
                        manipulate: "Click squares to build a wall across the room and compare the unchanged guess with the lengthening real route",
                        reveals: "The guess can never overshoot the real distance, because walls only ever make a journey longer",
                        paradigm: "constructivist",
                    },
                ]}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-both-halves" maxWidth="xl">
        <Block id="heuristic-both-halves" padding="sm">
            <EditableParagraph id="para-heuristic-both-halves" blockId="heuristic-both-halves">
                So the guess on its own is not enough, and ignoring it wastes half the search. A* keeps both
                halves: the distance already walked, plus the guess of what is still to come.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
