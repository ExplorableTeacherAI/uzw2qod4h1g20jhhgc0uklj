import React, { useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure, FormulaBlock } from "@/components/molecules";
import { useSetVar, useVar } from "@/stores";
import { clamp, remap, useSpring } from "@/lib/motion";
import {
    ASTAR_CHECKED,
    ASTAR_EXPANDED,
    ASTAR_ROUTE,
    BLIND_CHECKED,
    BLIND_ROUTE,
    DISTANCES,
    GRID_COLS,
    GRID_ROWS,
    isWall,
    NURSE,
    ROBOT,
    ROUTE_LENGTH,
} from "./hospitalFloorModel";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
} from "../variables";

// ── View geometry ────────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 440;
const CELL = 30;
const GRID_X = 85;
const GRID_Y = 56;

const TICK_X0 = 200;
const TICK_X1 = 536;
const MAX_PREDICTION = 30;
const TICK_W = (TICK_X1 - TICK_X0) / MAX_PREDICTION;
const BLIND_ROW_Y = 352;
const PREDICTION_ROW_Y = 386;

const INK = "#334155";
const INK_QUIET = "#CBD5E1";
const WALL_FILL = "#475569";
const CHECKED_FILL = "#64748B";
const ACCENT = "#62D0AD";

const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease, fill-opacity 150ms ease" } as const;

const formatChecked = (label: string, count: number) => `${label} checked ${count} squares`;
const formatSteps = (count: number) => `${count} steps`;

const cellX = (col: number) => GRID_X + col * CELL;
const cellY = (row: number) => GRID_Y + row * CELL;
const centreX = (col: number) => cellX(col) + CELL / 2;
const centreY = (row: number) => cellY(row) + CELL / 2;
const tickX = (steps: number) => TICK_X0 + steps * TICK_W;

const BLIND_CELLS: [number, number][] = DISTANCES.flatMap((rowValues, row) =>
    rowValues
        .map((distance, col) => ({ distance, col }))
        .filter((cell) => Number.isFinite(cell.distance))
        .map((cell) => [cell.col, row] as [number, number]),
);

const pathFor = (cells: [number, number][]) =>
    cells.map(([col, row], index) => `${index === 0 ? "M" : "L"} ${centreX(col)} ${centreY(row)}`).join(" ");

// ── Shared highlight ─────────────────────────────────────────────────────────

const useHighlightState = () => {
    const highlight = useVar<string>("comparisonHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.7 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("comparisonHighlight", id),
            onPointerLeave: () => setVar("comparisonHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

// ── The drawing ──────────────────────────────────────────────────────────────

function PredictionDrawing() {
    const setVar = useSetVar();
    const prediction = useVar<number>("predictedLength", 10);
    const revealed = useVar<boolean>("comparisonRevealed", false);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const movedRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered || isActive("prediction") ? 1.3 : 1, {
        stiffness: 400,
        damping: 26,
    });

    const setPredictionFromPointer = (event: React.PointerEvent) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        setVar(
            "predictedLength",
            clamp(Math.round(remap(x, TICK_X0, TICK_X1, 0, MAX_PREDICTION)), 1, MAX_PREDICTION),
        );
    };

    const labelStyle = {
        paintOrder: "stroke",
        stroke: "#FFFFFF",
        strokeWidth: 3,
        strokeLinejoin: "round",
    } as React.CSSProperties;

    const predictionLabel = revealed
        ? `A* route: ${formatSteps(ROUTE_LENGTH)}`
        : `your prediction: ${formatSteps(prediction)}`;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="The hospital floor with the blind search's result, and two rows of ticks comparing route lengths"
        >
            <defs>
                <filter id="comparison-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="32" fill={INK} opacity={opacity("blindChecked")}>
                    {formatChecked("blind search", BLIND_CHECKED)}
                </text>
                <text x={VIEW_WIDTH - 24} y="32" textAnchor="end" fill={ACCENT} opacity={opacity("astarChecked")}>
                    {revealed ? formatChecked("A*", ASTAR_CHECKED) : "A* has not run yet"}
                </text>
            </g>

            {/* The room. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                {Array.from({ length: GRID_ROWS }, (_, row) =>
                    Array.from({ length: GRID_COLS }, (_, col) => (
                        <rect
                            key={`floor-${col}-${row}`}
                            x={cellX(col)}
                            y={cellY(row)}
                            width={CELL}
                            height={CELL}
                            fill={isWall(col, row) ? WALL_FILL : "#FFFFFF"}
                            stroke={isWall(col, row) ? WALL_FILL : INK_QUIET}
                            strokeWidth="1"
                        />
                    )),
                )}
            </g>

            {/* What the blind search had to check. */}
            <g {...hoverProps("blindChecked")} opacity={opacity("blindChecked")} style={EASE_150}>
                {BLIND_CELLS.map(([col, row]) => (
                    <rect
                        key={`blind-${col}-${row}`}
                        x={cellX(col)}
                        y={cellY(row)}
                        width={CELL}
                        height={CELL}
                        fill={CHECKED_FILL}
                        fillOpacity={isActive("blindChecked") ? 0.34 : 0.16}
                        stroke={INK_QUIET}
                        strokeWidth="1"
                    />
                ))}
            </g>

            {/* What A* had to check — only after the prediction is committed. */}
            {revealed && (
                <g {...hoverProps("astarChecked")} opacity={opacity("astarChecked")} style={EASE_150}>
                    {ASTAR_EXPANDED.map(([col, row]) => (
                        <rect
                            key={`astar-${col}-${row}`}
                            x={cellX(col)}
                            y={cellY(row)}
                            width={CELL}
                            height={CELL}
                            fill={ACCENT}
                            fillOpacity={isActive("astarChecked") ? 0.5 : 0.3}
                            stroke={ACCENT}
                            strokeWidth="1"
                        />
                    ))}
                </g>
            )}

            {/* Both routes: the same length, drawn one over the other. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <path d={pathFor(BLIND_ROUTE)} fill="none" stroke={INK} strokeWidth="6" opacity={0.3} strokeLinecap="round" strokeLinejoin="round" />
                {revealed && (
                    <path d={pathFor(ASTAR_ROUTE)} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                <circle cx={centreX(ROBOT[0])} cy={centreY(ROBOT[1])} r="8" fill={INK} filter="url(#comparison-shadow)" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="8" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="3" fill={INK} />
                <g fill={INK} fontSize="11" textAnchor="middle" style={labelStyle}>
                    <text x={centreX(ROBOT[0])} y={centreY(ROBOT[1]) - 16}>robot</text>
                    <text x={centreX(NURSE[0])} y={centreY(NURSE[1]) - 16}>nurse</text>
                </g>
            </g>

            {/* Row one: the route the blind search found, one tick per step. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <text x="24" y={BLIND_ROW_Y + 4} fill={INK} fontSize="11" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`blind search: ${formatSteps(ROUTE_LENGTH)}`}
                </text>
                {Array.from({ length: ROUTE_LENGTH }, (_, index) => (
                    <line
                        key={`blind-tick-${index}`}
                        x1={tickX(index) + 2}
                        y1={BLIND_ROW_Y - 7}
                        x2={tickX(index) + 2}
                        y2={BLIND_ROW_Y + 7}
                        stroke={INK}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                ))}
            </g>

            {/* Row two: the student's prediction, then A*'s answer over the top. */}
            <g {...hoverProps("prediction")} opacity={opacity("prediction")} style={EASE_150}>
                <text x="24" y={PREDICTION_ROW_Y + 4} fill={ACCENT} fontSize="11" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {predictionLabel}
                </text>
                <line
                    x1={TICK_X0}
                    y1={PREDICTION_ROW_Y}
                    x2={TICK_X1}
                    y2={PREDICTION_ROW_Y}
                    stroke={INK_QUIET}
                    strokeWidth="1.5"
                />
                {revealed &&
                    Array.from({ length: ROUTE_LENGTH }, (_, index) => (
                        <line
                            key={`astar-tick-${index}`}
                            x1={tickX(index) + 2}
                            y1={PREDICTION_ROW_Y - 7}
                            x2={tickX(index) + 2}
                            y2={PREDICTION_ROW_Y + 7}
                            stroke={ACCENT}
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                    ))}
                {!revealed && (
                    <Halo active={isActive("prediction")}>
                        <line
                            x1={TICK_X0}
                            y1={PREDICTION_ROW_Y}
                            x2={tickX(prediction)}
                            y2={PREDICTION_ROW_Y}
                            stroke={ACCENT}
                            strokeWidth={weight("prediction", 3) + 6}
                            strokeLinecap="round"
                        />
                    </Halo>
                )}
                {!revealed && (
                    <line
                        x1={TICK_X0}
                        y1={PREDICTION_ROW_Y}
                        x2={tickX(prediction)}
                        y2={PREDICTION_ROW_Y}
                        stroke={ACCENT}
                        strokeWidth={weight("prediction", 3)}
                        strokeLinecap="round"
                    />
                )}
                {revealed && (
                    <g>
                        <line
                            x1={tickX(prediction)}
                            y1={PREDICTION_ROW_Y - 16}
                            x2={tickX(prediction)}
                            y2={PREDICTION_ROW_Y + 16}
                            stroke={INK}
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                        />
                        <text
                            x={tickX(prediction)}
                            y={PREDICTION_ROW_Y + 28}
                            fill={INK}
                            fontSize="11"
                            textAnchor={prediction > 24 ? "end" : "middle"}
                            style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                            {`you said ${prediction}`}
                        </text>
                    </g>
                )}
                {!revealed && (
                    <g transform={`translate(${tickX(prediction)} ${PREDICTION_ROW_Y}) scale(${handleScale})`}>
                        <circle r="9" fill={ACCENT} filter="url(#comparison-shadow)" />
                    </g>
                )}
            </g>

            {!revealed && (
                <circle
                    cx={tickX(prediction)}
                    cy={PREDICTION_ROW_Y}
                    r="26"
                    fill="transparent"
                    style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        draggingRef.current = true;
                        movedRef.current = false;
                        setDragging(true);
                    }}
                    onPointerMove={(event) => {
                        if (!draggingRef.current) return;
                        movedRef.current = true;
                        setPredictionFromPointer(event);
                    }}
                    onPointerUp={() => {
                        draggingRef.current = false;
                        setDragging(false);
                        // A prediction only counts once it has actually been moved.
                        if (movedRef.current) setVar("comparisonRevealed", true);
                    }}
                    onPointerCancel={() => {
                        draggingRef.current = false;
                        setDragging(false);
                    }}
                    onPointerEnter={() => setHovered(true)}
                    onPointerLeave={() => setHovered(false)}
                />
            )}

            {revealed && (
                <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 8} fontSize="12" textAnchor="middle" fill={INK}>
                    {`Both routes are ${ROUTE_LENGTH} steps. A* checked ${BLIND_CHECKED - ASTAR_CHECKED} fewer squares.`}
                </text>
            )}
        </svg>
    );
}

function PredictionFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="comparison-prediction"
            onReset={() => {
                setVar("predictedLength", 10);
                setVar("comparisonRevealed", false);
                setVar("comparisonHighlight", "");
            }}
            caption="The grey squares and the pale route are what the blind search did. Drag the teal row to predict A*'s route length, then let go and it runs."
        >
            <PredictionDrawing />
            <InteractionHintSequence
                hintKey="comparison-prediction-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the end of the teal row, then let go",
                        position: { x: "56%", y: "88%" },
                        dragPath: { type: "line", startOffset: { x: -26, y: 0 }, endOffset: { x: 26, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

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
                Here is the part worth being careful about. Before A* runs, drag the end of the{" "}
                <InlineLinkedHighlight
                    varName="comparisonHighlight"
                    highlightId="prediction"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('comparisonHighlight'))}
                >
                    empty row of ticks
                </InlineLinkedHighlight>{" "}
                under the map to say how long you think its route will be, then let go and watch it search.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-visual" maxWidth="xl">
        <Block id="comparison-visual" padding="sm" hasVisualization>
            <PredictionFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-trade" maxWidth="xl">
        <Block id="comparison-trade" padding="sm">
            <EditableParagraph id="para-comparison-trade" blockId="comparison-trade">
                Adding the guess never bought a shorter route: the walked-distance half of the score still
                refuses to let a longer one win. What it bought is the search, which stopped wandering backwards
                and leaned towards the nurse. Same route,{" "}
                <InlineLinkedHighlight
                    varName="comparisonHighlight"
                    highlightId="astarChecked"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('comparisonHighlight'))}
                >
                    far fewer squares checked
                </InlineLinkedHighlight>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-question-length" maxWidth="xl">
        <Block id="comparison-question-length" padding="md">
            <EditableParagraph id="para-comparison-question-length" blockId="comparison-question-length">
                <RevealOnInteraction varName="comparisonRevealed">
                    Whatever you predicted, the route A* came back with is{" "}
                    <InlineFeedback
                        varName="answer_comparison_length"
                        correctValue="exactly as long as"
                        position="mid"
                        successMessage="✓"
                        failureMessage="✗"
                        hint="Count the ticks in both rows, they line up"
                        visualizationHint={{
                            blockId: "comparison-visual",
                            hintKey: "feedback-comparison-length",
                            steps: [
                                {
                                    gesture: "drag-horizontal",
                                    label: "Drag your row until it ends level with the blind search's row above, then let go",
                                    position: { x: "56%", y: "88%" },
                                    completionVar: "predictedLength",
                                    completionValue: 17,
                                    completionTolerance: 0.4,
                                },
                            ],
                            label: "Discover it yourself",
                            resetVars: { comparisonRevealed: false, predictedLength: 10 },
                        }}
                    >
                        <InlineClozeChoice
                            varName="answer_comparison_length"
                            correctAnswer="exactly as long as"
                            options={["exactly as long as", "shorter than", "longer than"]}
                            {...choicePropsFromDefinition(getVariableInfo('answer_comparison_length'))}
                        />
                    </InlineFeedback>{" "}
                    the blind search's route. A* is faster to search, never shorter to walk.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-question-checked" maxWidth="xl">
        <Block id="comparison-question-checked" padding="md">
            <EditableParagraph id="para-comparison-question-checked" blockId="comparison-question-checked">
                <RevealOnInteraction varName="comparisonRevealed">
                    The blind search went through 92 squares to find that route. The number A* went through is{" "}
                    <InlineFeedback
                        varName="answer_comparison_checked"
                        correctValue={["54", "54 squares"]}
                        position="terminal"
                        successMessage="— 54 instead of 92, and not a single step added to the walk"
                        failureMessage="— not quite"
                        hint="The count sits in the top right corner of the map"
                    >
                        <InlineClozeInput
                            varName="answer_comparison_checked"
                            correctAnswer={["54", "54 squares"]}
                            {...clozePropsFromDefinition(getVariableInfo('answer_comparison_checked'))}
                        />
                    </InlineFeedback>.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
