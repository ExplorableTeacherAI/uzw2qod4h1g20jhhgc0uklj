import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineFormula,
    InlineHyperlink,
    InlineSpotColor,
    Table,
} from "@/components/atoms";
import { ASTAR_CHECKED, BLIND_CHECKED, ROUTE_LENGTH } from "./hospitalFloorModel";
import { FORMULA_COLORS, GUESS, TOTAL, WALKED } from "./lessonPalette";
import { getVariableInfo, spotColorPropsFromDefinition } from "../variables";

export const wrappingUpBlocks: ReactElement[] = [
    <StackLayout key="layout-conclusion-heading" maxWidth="xl">
        <Block id="conclusion-heading" padding="md">
            <EditableH2 id="h2-conclusion-heading" blockId="conclusion-heading">
                Wrapping Up
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-conclusion-one-family" maxWidth="xl">
        <Block id="conclusion-one-family" padding="sm">
            <EditableParagraph id="para-conclusion-one-family" blockId="conclusion-one-family">
                The blind search and A* were never really different algorithms. Both work outwards from the
                robot taking the cheapest square next; A* simply adds the{" "}
                <InlineSpotColor varName="astarNextH" {...spotColorPropsFromDefinition(getVariableInfo('astarNextH'))}>
                    guess
                </InlineSpotColor>{" "}
                to the{" "}
                <InlineSpotColor varName="astarNextG" {...spotColorPropsFromDefinition(getVariableInfo('astarNextG'))}>
                    steps walked
                </InlineSpotColor>
                , so cheapest comes to mean close to the nurse as well as close to home. Drop the guess to zero,{" "}
                <InlineFormula latex="\clr{f}{f} = \clr{g}{g} + \clr{h}{0} = \clr{g}{g}" colorMap={FORMULA_COLORS} />
                , and A* turns back into the blind search, which is exactly what happens on a map where nobody
                knows which way the goal lies.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-conclusion-summary-table" maxWidth="xl">
        <Block id="conclusion-summary-table" padding="sm">
            <Table
                columns={[
                    { header: "", align: "left", width: 200 },
                    { header: "Blind search", align: "center" },
                    { header: "A*", align: "center" },
                ]}
                rows={[
                    {
                        cells: [
                            "Picks the square with the smallest",
                            <InlineFormula latex="\clr{g}{g}" colorMap={FORMULA_COLORS} />,
                            <InlineFormula latex="\clr{f}{f} = \clr{g}{g} + \clr{h}{h}" colorMap={FORMULA_COLORS} />,
                        ],
                    },
                    {
                        cells: [
                            "Uses the nurse's position",
                            "never",
                            <InlineSpotColor varName="astarNextH" {...spotColorPropsFromDefinition(getVariableInfo('astarNextH'))}>
                                in every guess
                            </InlineSpotColor>,
                        ],
                    },
                    {
                        cells: [
                            "Squares checked",
                            <InlineHyperlink targetBlockId="blind-search-grid" color={WALKED} bgColor="rgba(142, 144, 245, 0.15)" showHint={false}>
                                {String(BLIND_CHECKED)}
                            </InlineHyperlink>,
                            <InlineHyperlink targetBlockId="comparison-trace" color={TOTAL} bgColor="rgba(98, 208, 173, 0.15)" showHint={false}>
                                {String(ASTAR_CHECKED)}
                            </InlineHyperlink>,
                        ],
                    },
                    {
                        cells: ["Route length", `${ROUTE_LENGTH} steps`, `${ROUTE_LENGTH} steps`],
                        highlight: true,
                        highlightColor: GUESS,
                    },
                ]}
                color={TOTAL}
                caption="The two searches side by side. The highlighted row is the whole point: the route never changes, only the searching does. Click a count to jump back to its map."
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-conclusion-takeaway" maxWidth="xl">
        <Block id="conclusion-takeaway" padding="sm">
            <EditableParagraph id="para-conclusion-takeaway" blockId="conclusion-takeaway">
                That is why the two searches end with routes of the same length while one of them checks a
                fraction of the room. A* does not find better paths. It finds the same path having wasted less
                time looking, and that is the difference between a game character who moves the instant you
                click and one that stops to think.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
