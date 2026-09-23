import React, { useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { SplitLayout, StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InlineSpotColor,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure, FigureSlider } from "@/components/molecules";
import { useSetVar, useVar } from "@/stores";
import { clamp, remap, useSpring } from "@/lib/motion";
import {
    EASE_150,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    LABEL_OUTLINE,
    NURSE_RING,
    NURSE_TEXT,
    ROBOT_EDGE,
    ROBOT_FILL,
    WALKED,
    WALKED_TEXT,
    WALL_FILL,
} from "./lessonPalette";
import { NurseWord, RobotWord } from "./actors";
import {
    CHECKED_COUNTS,
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
    numberPropsFromDefinition,
    spotColorPropsFromDefinition,
} from "../variables";

const MAX_COUNT_AXIS = 100;
const DEFAULT_STEP = 4;

// ── Shared view geometry — both figures use the same frame ───────────────────

const VIEW_WIDTH = 386;
const VIEW_HEIGHT = 310;
const CELL = 26;
const GRID_X = 24;
const GRID_Y = 52;

const PLOT_LEFT = 52;
const PLOT_RIGHT = 362;
const PLOT_TOP = 72;
const PLOT_BOTTOM = 256;

// The blind search orders by g — steps walked from the robot — so it is indigo throughout.
const ACCENT = WALKED;

// One formatter per quantity, called by BOTH views.
const formatChecked = (count: number) => `${count} squares checked`;
const formatStep = (step: number) => `${step} steps out`;

const checkedAt = (step: number) => CHECKED_COUNTS[clamp(Math.round(step), 0, ROUTE_LENGTH)];

// ── Shared highlight (the correspondence between the two views) ──────────────

const useHighlightState = () => {
    const highlight = useVar<string>("blindSearchHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.7 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("blindSearchHighlight", id),
            onPointerLeave: () => setVar("blindSearchHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

/** Identical readout strip in both figures — the numbers are the visible tie. */
function SharedReadouts({ step }: { step: number }) {
    const { opacity } = useHighlightState();
    return (
        <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
            <text x="24" y="32" fill={WALKED_TEXT} opacity={opacity("checked")}>
                {formatChecked(checkedAt(step))}
            </text>
            <text x={VIEW_WIDTH - 24} y="32" fill={WALKED_TEXT} fontWeight={600} textAnchor="end" opacity={opacity("frontier")}>
                {formatStep(step)}
            </text>
        </g>
    );
}

// ── VIEW A: the floor plan, checked squares shading outwards ─────────────────

function FloorPlanDrawing() {
    const setVar = useSetVar();
    const step = useVar<number>("blindSearchStep", DEFAULT_STEP);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);

    const stepFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        const y = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
        const col = Math.floor((x - GRID_X) / CELL);
        const row = Math.floor((y - GRID_Y) / CELL);
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
        const distance = DISTANCES[row][col];
        if (!Number.isFinite(distance)) return;
        setVar("blindSearchStep", clamp(distance, 0, ROUTE_LENGTH));
        setVar("blindSearchExplored", true);
    };

    const cellX = (col: number) => GRID_X + col * CELL;
    const cellY = (row: number) => GRID_Y + row * CELL;

    const cells: { col: number; row: number; distance: number }[] = [];
    for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < GRID_COLS; col += 1) {
            cells.push({ col, row, distance: DISTANCES[row][col] });
        }
    }
    const checkedCells = cells.filter((cell) => Number.isFinite(cell.distance) && cell.distance < step);
    const frontierCells = cells.filter((cell) => cell.distance === step);

    const markerCenter = (cell: [number, number]) => ({
        x: cellX(cell[0]) + CELL / 2,
        y: cellY(cell[1]) + CELL / 2,
    });
    const robot = markerCenter(ROBOT);
    const nurse = markerCenter(NURSE);
    const labelStyle = LABEL_OUTLINE as React.CSSProperties;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="Hospital floor grid; each square the search has checked shows its distance from the robot, with a draggable indigo edge"
            style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                draggingRef.current = true;
                setDragging(true);
                stepFromPointer(event);
            }}
            onPointerMove={(event) => {
                if (!draggingRef.current) return;
                stepFromPointer(event);
            }}
            onPointerUp={() => {
                draggingRef.current = false;
                setDragging(false);
            }}
            onPointerCancel={() => {
                draggingRef.current = false;
                setDragging(false);
            }}
        >
            <defs>
                <filter id="blind-search-marker-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <SharedReadouts step={step} />

            {/* Ambient structure: the room itself, its walls and its two people. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                {cells.map((cell) => (
                    <rect
                        key={`floor-${cell.col}-${cell.row}`}
                        x={cellX(cell.col)}
                        y={cellY(cell.row)}
                        width={CELL}
                        height={CELL}
                        fill={isWall(cell.col, cell.row) ? WALL_FILL : "#FFFFFF"}
                        stroke={isWall(cell.col, cell.row) ? WALL_FILL : INK_QUIET}
                        strokeWidth="1"
                    />
                ))}
            </g>

            {/* CHECKED squares — counterpart of the shaded area under the graph.
                Each one carries g, its distance from the robot: the number the
                blind search ordered it by. */}
            <g {...hoverProps("checked")} opacity={opacity("checked")} style={EASE_150}>
                {checkedCells.map((cell) => (
                    <rect
                        key={`checked-${cell.col}-${cell.row}`}
                        x={cellX(cell.col)}
                        y={cellY(cell.row)}
                        width={CELL}
                        height={CELL}
                        fill={ACCENT}
                        fillOpacity={isActive("checked") ? 0.3 : 0.12}
                        stroke={INK_QUIET}
                        strokeWidth="1"
                    />
                ))}
                <g
                    fontSize="10"
                    textAnchor="middle"
                    fill={isActive("checked") ? WALKED_TEXT : "#94A3B8"}
                    fontWeight={isActive("checked") ? 600 : 400}
                    style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}
                >
                    {checkedCells.map((cell) => (
                        <text key={`distance-${cell.col}-${cell.row}`} x={cellX(cell.col) + CELL / 2} y={cellY(cell.row) + CELL / 2 + 3.5}>
                            {cell.distance}
                        </text>
                    ))}
                </g>
            </g>

            {/* THE FRONTIER — the teal edge the student drags, and the graph's dot. */}
            <g {...hoverProps("frontier")} opacity={opacity("frontier")} style={EASE_150}>
                <Halo active={isActive("frontier")}>
                    {frontierCells.map((cell) => (
                        <rect
                            key={`frontier-halo-${cell.col}-${cell.row}`}
                            x={cellX(cell.col)}
                            y={cellY(cell.row)}
                            width={CELL}
                            height={CELL}
                            fill="none"
                            stroke={ACCENT}
                            strokeWidth={weight("frontier", 2.5) + 6}
                        />
                    ))}
                </Halo>
                {frontierCells.map((cell) => (
                    <rect
                        key={`frontier-${cell.col}-${cell.row}`}
                        x={cellX(cell.col)}
                        y={cellY(cell.row)}
                        width={CELL}
                        height={CELL}
                        fill={ACCENT}
                        fillOpacity={isActive("frontier") ? 0.5 : 0.3}
                        stroke={ACCENT}
                        strokeWidth={weight("frontier", 2.5)}
                    />
                ))}
                <g
                    fontSize="10"
                    fontWeight={600}
                    textAnchor="middle"
                    fill={WALKED_TEXT}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {frontierCells.map((cell) => (
                        <text key={`frontier-distance-${cell.col}-${cell.row}`} x={cellX(cell.col) + CELL / 2} y={cellY(cell.row) + CELL / 2 + 3.5}>
                            {cell.distance}
                        </text>
                    ))}
                </g>
            </g>

            {/* The two people, drawn last so the shading never buries them. The
                nurse keeps her own colour; this search never looks at her. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <circle cx={robot.x} cy={robot.y} r="8" fill={ROBOT_FILL} stroke={ROBOT_EDGE} strokeWidth="2" filter="url(#blind-search-marker-shadow)" />
                <text x={robot.x} y={robot.y - 14} fill={ROBOT_EDGE} fontSize="11" fontWeight={600} textAnchor="middle" style={labelStyle}>robot</text>
            </g>
            <g {...hoverProps("nurse")} opacity={opacity("nurse")} style={EASE_150}>
                <Halo active={isActive("nurse")}>
                    <circle cx={nurse.x} cy={nurse.y} r="8" fill="none" stroke={NURSE_RING} strokeWidth={weight("nurse", 2.5) + 6} />
                </Halo>
                <circle cx={nurse.x} cy={nurse.y} r="8" fill="#FFFFFF" stroke={NURSE_RING} strokeWidth={weight("nurse", 2.5)} />
                <circle cx={nurse.x} cy={nurse.y} r="3" fill={NURSE_RING} />
                <text x={nurse.x} y={nurse.y - 14} fill={NURSE_TEXT} fontSize="11" fontWeight={600} textAnchor="middle" style={labelStyle}>nurse</text>
            </g>
        </svg>
    );
}

// ── VIEW B: the same search, counted ─────────────────────────────────────────

function CheckedCountDrawing() {
    const setVar = useSetVar();
    const step = useVar<number>("blindSearchStep", DEFAULT_STEP);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered || isActive("frontier") ? 1.3 : 1, {
        stiffness: 400,
        damping: 26,
    });

    const xForStep = (value: number) => remap(value, 0, ROUTE_LENGTH, PLOT_LEFT, PLOT_RIGHT);
    const yForCount = (count: number) => remap(count, 0, MAX_COUNT_AXIS, PLOT_BOTTOM, PLOT_TOP);

    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        setVar(
            "blindSearchStep",
            clamp(Math.round(remap(x, PLOT_LEFT, PLOT_RIGHT, 0, ROUTE_LENGTH)), 0, ROUTE_LENGTH),
        );
        setVar("blindSearchExplored", true);
    };

    const tracedSteps = Array.from({ length: Math.round(step) + 1 }, (_, index) => index);
    const tracedPoints = tracedSteps.map((value) => `${xForStep(value)} ${yForCount(CHECKED_COUNTS[value])}`);
    const tracedPath = tracedPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point}`).join(" ");
    const areaPath =
        `M ${xForStep(0)} ${PLOT_BOTTOM} ` +
        tracedPoints.map((point) => `L ${point}`).join(" ") +
        ` L ${xForStep(step)} ${PLOT_BOTTOM} Z`;

    const markerX = xForStep(step);
    const markerY = yForCount(checkedAt(step));

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="Graph of squares checked against steps out from the robot, with a draggable marker"
        >
            <defs>
                <filter id="blind-search-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <SharedReadouts step={step} />

            <g opacity={opacity("__structure")} style={EASE_150}>
                <text x="24" y="62" fill={INK} fontSize="11">squares checked</text>
                {[0, 50, 100].map((count) => (
                    <g key={`y-tick-${count}`}>
                        <line
                            x1={PLOT_LEFT}
                            y1={yForCount(count)}
                            x2={PLOT_RIGHT}
                            y2={yForCount(count)}
                            stroke={INK_QUIET}
                            strokeWidth="1"
                        />
                        <text
                            x={PLOT_LEFT - 8}
                            y={yForCount(count) + 4}
                            fill={INK}
                            fontSize="11"
                            textAnchor="end"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                            {count}
                        </text>
                    </g>
                ))}
                <line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_BOTTOM} stroke={INK_STRUCTURE} strokeWidth="1.5" />
                <g fill={INK} fontSize="11" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <text x={xForStep(0)} y={PLOT_BOTTOM + 20} textAnchor="start">0</text>
                    <text x={xForStep(5)} y={PLOT_BOTTOM + 20} textAnchor="middle">5</text>
                    <text x={xForStep(10)} y={PLOT_BOTTOM + 20} textAnchor="middle">10</text>
                    <text x={xForStep(15)} y={PLOT_BOTTOM + 20} textAnchor="middle">15</text>
                </g>
                <text x={(PLOT_LEFT + PLOT_RIGHT) / 2} y={PLOT_BOTTOM + 42} fill={INK} fontSize="11" textAnchor="middle">
                    steps out from the robot
                </text>
            </g>

            {/* CHECKED — the running total, counterpart of the shaded squares. */}
            <g {...hoverProps("checked")} opacity={opacity("checked")} style={EASE_150}>
                <path d={areaPath} fill={ACCENT} fillOpacity={isActive("checked") ? 0.35 : 0.15} stroke="none" />
                <path
                    d={tracedPath}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={weight("checked", 2.5)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>

            {/* FRONTIER — the current point, counterpart of the teal edge. */}
            <g {...hoverProps("frontier")} opacity={opacity("frontier")} style={EASE_150}>
                <Halo active={isActive("frontier")}>
                    <line
                        x1={markerX}
                        y1={PLOT_BOTTOM}
                        x2={markerX}
                        y2={markerY}
                        stroke={ACCENT}
                        strokeWidth={weight("frontier", 2.5) + 6}
                        strokeLinecap="round"
                    />
                </Halo>
                <line
                    x1={markerX}
                    y1={PLOT_BOTTOM}
                    x2={markerX}
                    y2={markerY}
                    stroke={ACCENT}
                    strokeWidth="1.5"
                    strokeDasharray="3 4"
                    opacity={0.7}
                />
                <g transform={`translate(${markerX} ${markerY}) scale(${handleScale})`}>
                    <circle r="7" fill={ACCENT} filter="url(#blind-search-dot-shadow)" />
                </g>
            </g>

            <circle
                cx={markerX}
                cy={markerY}
                r="24"
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={() => {
                    draggingRef.current = false;
                    setDragging(false);
                }}
                onPointerCancel={() => {
                    draggingRef.current = false;
                    setDragging(false);
                }}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            />
        </svg>
    );
}

// ── Figure shells ────────────────────────────────────────────────────────────

function FloorPlanFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="blind-search-floor-plan"
            onReset={() => {
                setVar("blindSearchStep", DEFAULT_STEP);
                setVar("blindSearchHighlight", "");
            }}
            caption="The robot's floor. Drag the indigo edge outwards: every square the search has been through is shaded and carries its distance from the robot."
        >
            <FloorPlanDrawing />
            <InteractionHintSequence
                hintKey="blind-search-floor-drag"
                steps={[
                    {
                        gesture: "drag",
                        label: "Drag the indigo edge outwards, ring by ring",
                        position: { x: "43%", y: "55%" },
                        dragPath: { type: "line", startOffset: { x: -22, y: 0 }, endOffset: { x: 30, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

function CheckedCountFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="blind-search-count-graph"
            onReset={() => {
                setVar("blindSearchStep", DEFAULT_STEP);
                setVar("blindSearchHighlight", "");
            }}
            caption="The same search, counted. Drag this marker instead and the floor plan keeps pace with it."
        >
            <CheckedCountDrawing />
            <div className="px-6 pb-5">
                <FigureSlider
                    varName="blindSearchStep"
                    label="Steps out"
                    {...numberPropsFromDefinition(getVariableInfo('blindSearchStep'))}
                    formatValue={formatStep}
                />
            </div>
            <InteractionHintSequence
                hintKey="blind-search-graph-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the marker along the curve",
                        position: { x: "32%", y: "61%" },
                        dragPath: { type: "line", startOffset: { x: -26, y: 0 }, endOffset: { x: 26, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

/** The running total, in prose, through the same formatter as the figures. */
function BlindSearchCheckedCount() {
    const step = useVar<number>("blindSearchStep", DEFAULT_STEP);
    return (
        <InlineSpotColor varName="blindSearchStep" {...spotColorPropsFromDefinition(getVariableInfo('blindSearchStep'))}>
            {String(checkedAt(step))}
        </InlineSpotColor>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

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
                Put yourself in the <RobotWord>robot's</RobotWord> position. You know your own square and the <NurseWord>nurse's</NurseWord>, but you cannot
                see the walls until you reach them. With no sense of which way to head, the only safe move is to
                check the nearest unchecked square, then the next nearest, outwards.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-blind-search-cost" maxWidth="xl">
        <Block id="blind-search-cost" padding="sm">
            <EditableParagraph id="para-blind-search-cost" blockId="blind-search-cost">
                It works: it never misses a shorter route, because it always finishes the close squares before
                the far ones. The price is everything it checks on the way. Grab the{" "}
                <InlineLinkedHighlight
                    varName="blindSearchHighlight"
                    highlightId="frontier"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('blindSearchHighlight'))}
                >
                    indigo edge
                </InlineLinkedHighlight>{" "}
                of the shaded area and pull it outwards, ring by ring, until the search first touches the <NurseWord />.
                The number printed on each square is its{" "}
                <InlineSpotColor varName="blindSearchStep" {...spotColorPropsFromDefinition(getVariableInfo('blindSearchStep'))}>
                    distance from the robot
                </InlineSpotColor>
                , and that number is the only thing the search ever looks at.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <SplitLayout key="layout-blind-search-pair" ratio="1:1" gap="lg" align="start">
        <Block id="blind-search-grid" padding="sm" hasVisualization>
            <FloorPlanFigure />
        </Block>
        <Block id="blind-search-count" padding="sm" hasVisualization>
            <CheckedCountFigure />
        </Block>
    </SplitLayout>,

    <StackLayout key="layout-blind-search-live" maxWidth="xl">
        <Block id="blind-search-live" padding="sm">
            <EditableParagraph id="para-blind-search-live" blockId="blind-search-live">Right now the search has spread <InlineScrubbleNumber varName={"blindSearchStep"} defaultValue={4} min={0} max={17} step={1} color={"#8E90F5"} id={"scrubble-1790144016900-wfi4h"} /> steps out from the <InlineSpotColor varName={"actorRobot"} color={"#62CCF9"} id={"spotColor-1790144016901-60wcp"}>robot</InlineSpotColor>, and to get there it has checked <InlineSpotColor varName={"blindSearchStep"} color={"#8E90F5"} id={"spotColor-1790144016901-ppuxi"}>92</InlineSpotColor> squares.</EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-blind-search-gap" maxWidth="xl">
        <Block id="blind-search-gap" padding="sm">
            <EditableParagraph id="para-blind-search-gap" blockId="blind-search-gap">Notice what the search never used: <InlineLinkedHighlight varName={"blindSearchHighlight"} highlightId={"nurse"} color={"#F8A0CD"} bgColor={"rgba(248, 160, 205, 0.25)"} id={"linkedHighlight-1790144500532-13lhd"}>the nurse's position</InlineLinkedHighlight>. It knows perfectly well where she is, and every one of those <InlineLinkedHighlight varName={"blindSearchHighlight"} highlightId={"checked"} color={"#a855f7"} bgColor={"rgba(168, 85, 247, 0.22)"} id={"linkedHighlight-1790144500532-np1m3"}>shaded squares</InlineLinkedHighlight> was chosen for being close to the <InlineSpotColor varName={"actorRobot"} color={"#62CCF9"} id={"spotColor-1790144500532-4v0ur"}>robot</InlineSpotColor> instead. That pile of checked squares is exactly what A* is going to save.'</EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-blind-search-question-order" maxWidth="xl">
        <Block id="blind-search-question-order" padding="md">
            <EditableParagraph id="para-blind-search-question-order" blockId="blind-search-question-order">
                So, with no idea which way the <NurseWord /> lies, this search works through the squares in order of
                their distance from{" "}
                <InlineFeedback
                    varName="answer_blind_search_order"
                    correctValue="the robot"
                    position="terminal"
                    successMessage="— exactly, and it is the only ordering it can trust while the goal plays no part in the decision"
                    failureMessage="— not quite"
                    hint="The only square the robot has actually stood on is the one it started from"
                    visualizationHint={{
                        blockId: "blind-search-grid",
                        hintKey: "feedback-blind-search-order",
                        steps: [
                            {
                                gesture: "drag",
                                label: "Pull the indigo edge outwards a few rings — watch which square the shading grows around",
                                position: { x: "43%", y: "55%" },
                                dragPath: { type: "line", startOffset: { x: -22, y: 0 }, endOffset: { x: 34, y: 0 } },
                                completionVar: "blindSearchStep",
                                completionValue: 7,
                                completionTolerance: 2,
                            },
                        ],
                        label: "Discover it yourself",
                        resetVars: { blindSearchStep: 1 },
                    }}
                >
                    <InlineClozeChoice
                        varName="answer_blind_search_order"
                        correctAnswer="the robot"
                        options={["the robot", "the nurse", "the nearest wall"]}
                        {...choicePropsFromDefinition(getVariableInfo('answer_blind_search_order'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-blind-search-question-count" maxWidth="xl">
        <Block id="blind-search-question-count" padding="md">
            <EditableParagraph id="para-blind-search-question-count" blockId="blind-search-question-count">
                <RevealOnInteraction varName="blindSearchExplored">
                    Now wind the search all the way out, until the shading first touches the <NurseWord />. Her route
                    turns out to be 17 steps long, and the number of squares checked to find it is{" "}
                    <InlineFeedback
                        varName="answer_blind_search_count"
                        correctValue={["92", "92 squares"]}
                        position="terminal"
                        successMessage="— 92 squares checked for a 17-step walk, and most of them lay in entirely the wrong direction"
                        failureMessage="— not quite"
                        hint="Read the count in the top corner of the map at the moment the shading reaches her"
                        visualizationHint={{
                            blockId: "blind-search-grid",
                            hintKey: "feedback-blind-search-count",
                            steps: [
                                {
                                    gesture: "drag",
                                    label: "Pull the indigo edge all the way out until it reaches the nurse",
                                    position: { x: "43%", y: "55%" },
                                    dragPath: { type: "line", startOffset: { x: -22, y: 0 }, endOffset: { x: 40, y: 0 } },
                                    completionVar: "blindSearchStep",
                                    completionValue: 17,
                                    completionTolerance: 1,
                                },
                            ],
                            label: "Discover it yourself",
                            resetVars: { blindSearchStep: 4 },
                        }}
                    >
                        <InlineClozeInput
                            varName="answer_blind_search_count"
                            correctAnswer={["92", "92 squares"]}
                            {...clozePropsFromDefinition(getVariableInfo('answer_blind_search_count'))}
                        />
                    </InlineFeedback>.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
