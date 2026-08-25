import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

export const searchingBlindBlocks: ReactElement[] = [
    <StackLayout key="layout-blind-search-heading" maxWidth="xl">
        <Block id="blind-search-heading" padding="md">
            <EditableH2 id="h2-blind-search-heading" blockId="blind-search-heading">
                Searching Blind
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-blind-search-setup" maxWidth="xl">
        <Block id="blind-search-setup" padding="sm">
            <EditableParagraph id="para-blind-search-setup" blockId="blind-search-setup">
                Put yourself in the robot's position. You know your own square and you know the goal square,
                but you cannot see the walls until you reach them. With no sense of which way the goal lies,
                the only safe move is to check the nearest unchecked square, then the next nearest, and keep
                going outwards.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-blind-search-cost" maxWidth="xl">
        <Block id="blind-search-cost" padding="sm">
            <EditableParagraph id="para-blind-search-cost" blockId="blind-search-cost">
                That is a real algorithm, and it works: it never misses a shorter route, because it always
                finishes the close squares before the far ones. The price is everything it checks along the
                way. So how many squares does a search like that get through before the goal turns up?
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-blind-search-visual" maxWidth="xl">
        <Block id="blind-search-visual">
            <VisualOptionCards
                blockId="blind-search-visual"
                cards={[
                    {
                        id: "spreading-blob",
                        title: "A hospital floor grid where every checked square turns grey, spreading out from the robot",
                        looks: "Imagine the floor plan drawn as a grid of squares, walls in dark blocks, the robot on one square and the nurse on another. Every square the search has looked at is shaded grey, so a growing blob creeps outwards from the robot, with a graph beside it counting the shaded squares as the search goes on.",
                        manipulate: "Drag the edge of the grey area outwards to advance the search one ring of squares at a time, and back inwards to undo it",
                        reveals: "The search grows like a circle, checking squares behind the robot just as eagerly as squares towards the nurse",
                        paradigm: "temporal",
                        recommended: true,
                        secondView: {
                            shows: "A graph of the number of squares checked as the search advances",
                            role: "complementary",
                            syncedBy: "searchStep, plus a shared hover highlight on the outer ring of checked squares",
                        },
                    },
                    {
                        id: "paint-your-guess",
                        title: "A blank floor grid where students shade in the squares they expect the search to check",
                        looks: "Imagine the same room with no shading at all, just the robot and the nurse marked on it. Students paint squares themselves by dragging across the map, and when they let go the real search runs and lays its own shaded area over the top of theirs.",
                        manipulate: "Paint the squares they think the search will check before it reaches the nurse, then release to see the real shaded area appear",
                        reveals: "Most students paint a corridor heading for the nurse, while the real search shades a wide blob in every direction",
                        paradigm: "prediction",
                    },
                    {
                        id: "build-the-room",
                        title: "A floor grid where students place the walls themselves and the search refills the room",
                        looks: "Imagine an empty room with the robot and the nurse already marked. Students click squares to turn them into walls, and after each change the search runs again, shading every square it had to check, with the count printed beside the map.",
                        manipulate: "Click squares to drop walls into the room and watch the shaded area reshape itself around them",
                        reveals: "However the walls are arranged, the search still floods outwards evenly and checks far more of the room than the route actually needs",
                        paradigm: "constructivist",
                    },
                ]}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-blind-search-gap" maxWidth="xl">
        <Block id="blind-search-gap" padding="sm">
            <EditableParagraph id="para-blind-search-gap" blockId="blind-search-gap">
                Notice what this search never uses: the goal's position. It knows perfectly well where the nurse
                is, and it still spreads out in every direction with equal enthusiasm. That is the gap A* walks
                into.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
