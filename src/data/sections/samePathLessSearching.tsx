import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { FormulaBlock } from "@/components/molecules";
import { VisualOptionCards } from "@/components/organisms";

export const samePathLessSearchingBlocks: ReactElement[] = [
    <StackLayout key="layout-comparison-heading" maxWidth="xl">
        <Block id="comparison-heading" padding="md">
            <EditableH2 id="h2-comparison-heading" blockId="comparison-heading">
                Same Path, Less Searching
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-scoring" maxWidth="xl">
        <Block id="comparison-scoring" padding="sm">
            <EditableParagraph id="para-comparison-scoring" blockId="comparison-scoring">
                A* scores every square it might check with two numbers added together: the steps already walked
                to get there, plus the guess of the steps still to come. It always checks the square with the
                smallest total next. A square behind the robot scores badly because the walk there was wasted,
                and a far-off square scores badly because its guess is large.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-formula" maxWidth="xl">
        <Block id="comparison-formula" padding="lg">
            <FormulaBlock latex="f = g + h" />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-misconception" maxWidth="xl">
        <Block id="comparison-misconception" padding="sm">
            <EditableParagraph id="para-comparison-misconception" blockId="comparison-misconception">
                Here is the part worth being careful about. Adding the guess does not buy a shorter route: the
                walked-distance half of the score still refuses to let a longer route win. What it buys is the
                search itself, which stops wandering backwards and leans towards the nurse instead.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-visual" maxWidth="xl">
        <Block id="comparison-visual">
            <VisualOptionCards
                blockId="comparison-visual"
                cards={[
                    {
                        id: "predict-the-length",
                        title: "One map, with a row of ticks where students mark how long they think the A* route will be",
                        looks: "Imagine the room with the blind search already finished on it: its shaded squares and its route drawn as a line, with that route's length shown as a row of ticks along the bottom. A second, empty row of ticks waits underneath for the route A* is about to find.",
                        manipulate: "Drag the end of the empty row to predict how many steps A*'s route will take, then release to watch A* search the map and draw its own route",
                        reveals: "A*'s route comes out at exactly the same length as the blind search's, while the shaded area shrinks dramatically",
                        targetsMisconception: "Students think A* finds a shorter path, not the same path with less searching",
                        paradigm: "prediction",
                        recommended: true,
                    },
                    {
                        id: "two-maps-side-by-side",
                        title: "The same floor plan twice, side by side, one searched blindly and one searched by A*",
                        looks: "Imagine two copies of the same room with the robot and the nurse in the same places on both. Each map shades in the squares its own search checked and draws its finished route on top, with the number of checked squares and the route length printed underneath, and a graph beside them putting the two totals next to each other.",
                        manipulate: "Drag the nurse to a new square on either map, which moves her on both, and both searches run again",
                        reveals: "Wherever the nurse is put, the two routes come out the same length while A*'s checked total stays far smaller",
                        targetsMisconception: "Students think A* finds a shorter path, not the same path with less searching",
                        paradigm: "comparison",
                        secondView: {
                            shows: "A pair of bars comparing squares checked and route length for the two searches",
                            role: "complementary",
                            syncedBy: "goalSquare and the wall layout, plus a shared hover highlight linking each map to its bar",
                        },
                    },
                    {
                        id: "slow-a-star-down",
                        title: "A floor plan where students rearrange the walls to try to slow A* down",
                        looks: "Imagine the room with the robot and the nurse fixed in place, the squares A* checks shaded in teal and the wider area the blind search would check outlined in grey around them. Two counters and the length of the route sit beside the map.",
                        manipulate: "Drag walls into new positions to try to force A* into checking as many squares as the blind search does",
                        reveals: "A maze of dead ends can push A*'s total up towards the blind search's, but its route never comes out longer",
                        paradigm: "goal",
                    },
                ]}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-trade" maxWidth="xl">
        <Block id="comparison-trade" padding="sm">
            <EditableParagraph id="para-comparison-trade" blockId="comparison-trade">
                Same length of route, far fewer squares checked. That is the whole trade, and it is why A* is
                what runs inside a game character or a satnav rather than the blind search.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
