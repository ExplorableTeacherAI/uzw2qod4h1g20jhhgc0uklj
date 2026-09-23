import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineFormula,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InlineSpotColor,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure, FigureSlider, FormulaBlock } from "@/components/molecules";
import { useSetVar, useVar } from "@/stores";
import { clamp, remap, useRafLoop, useSpring } from "@/lib/motion";
import {
    ASTAR_CHECKED,
    ASTAR_EXPANDED,
    ASTAR_ROUTE,
    ASTAR_TRACE,
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
    EASE_150,
    FORMULA_COLORS,
    GUESS_TEXT,
    INK,
    INK_QUIET,
    LABEL_OUTLINE,
    NURSE_RING,
    NURSE_TEXT,
    ROBOT_EDGE,
    ROBOT_FILL,
    TOTAL,
    TOTAL_TEXT,
    WALKED,
    WALKED_TEXT,
    WALL_FILL,
} from "./lessonPalette";
import { NurseWord, RobotWord } from "./actors";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
    spotColorPropsFromDefinition,
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

// The blind search is indigo (it orders by g); A* is teal (it orders by f).
const BLIND = WALKED;
const ACCENT = TOTAL;

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

    const labelStyle = LABEL_OUTLINE as React.CSSProperties;

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
                <text x="24" y="32" fill={WALKED_TEXT} opacity={opacity("blindChecked")}>
                    {formatChecked("blind search", BLIND_CHECKED)}
                </text>
                <text x={VIEW_WIDTH - 70} y="32" textAnchor="end" fill={TOTAL_TEXT} opacity={opacity("astarChecked")}>
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
                        fill={BLIND}
                        fillOpacity={isActive("blindChecked") ? 0.34 : 0.14}
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
                <path d={pathFor(BLIND_ROUTE)} fill="none" stroke={BLIND} strokeWidth="7" opacity={0.45} strokeLinecap="round" strokeLinejoin="round" />
                {revealed && (
                    <path d={pathFor(ASTAR_ROUTE)} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                <circle cx={centreX(ROBOT[0])} cy={centreY(ROBOT[1])} r="8" fill={ROBOT_FILL} stroke={ROBOT_EDGE} strokeWidth="2" filter="url(#comparison-shadow)" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="8" fill="#FFFFFF" stroke={NURSE_RING} strokeWidth="2.5" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="3" fill={NURSE_RING} />
                <g fontSize="11" fontWeight={600} textAnchor="middle" style={labelStyle}>
                    <text x={centreX(ROBOT[0])} y={centreY(ROBOT[1]) - 16} fill={ROBOT_EDGE}>robot</text>
                    <text x={centreX(NURSE[0])} y={centreY(NURSE[1]) - 16} fill={NURSE_TEXT}>nurse</text>
                </g>
            </g>

            {/* Row one: the route the blind search found, one tick per step. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <text x="24" y={BLIND_ROW_Y + 4} fill={WALKED_TEXT} fontSize="11" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`blind search: ${formatSteps(ROUTE_LENGTH)}`}
                </text>
                {Array.from({ length: ROUTE_LENGTH }, (_, index) => (
                    <line
                        key={`blind-tick-${index}`}
                        x1={tickX(index) + 2}
                        y1={BLIND_ROW_Y - 7}
                        x2={tickX(index) + 2}
                        y2={BLIND_ROW_Y + 7}
                        stroke={BLIND}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                ))}
            </g>

            {/* Row two: the student's prediction, then A*'s answer over the top. */}
            <g {...hoverProps("prediction")} opacity={opacity("prediction")} style={EASE_150}>
                <text x="24" y={PREDICTION_ROW_Y + 4} fill={TOTAL_TEXT} fontSize="11" style={{ fontVariantNumeric: "tabular-nums" }}>
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
            caption="The indigo squares and the pale indigo route are what the blind search did. Drag the teal row to predict A*'s route length, then let go and A* runs."
        >
            <PredictionDrawing />
            <InteractionHintSequence
                hintKey="comparison-prediction-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the end of the teal row, then let go",
                        position: { x: "56%", y: "80%" },
                        dragPath: { type: "line", startOffset: { x: -26, y: 0 }, endOffset: { x: 26, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

// ── Watching A* choose ───────────────────────────────────────────────────────
// The same room, replayed one decision at a time from the recorded trace.

const TRACE_VIEW_HEIGHT = 356;
const DEFAULT_ASTAR_STEP = 20;
/** Seconds between checks when the step-through plays. */
const ASTAR_PLAY_PERIOD = 0.3;
/** Figure shell height (drawing + slider row + hint strip) relative to the drawing alone. */
const HINT_SHELL_RATIO = 1.23;

const clampStep = (value: number) => clamp(Math.round(value), 0, ASTAR_CHECKED);
/** The decision on show: the next pick while the search runs, the nurse once it is done. */
const snapshotAt = (step: number) => ASTAR_TRACE[Math.min(clampStep(step), ASTAR_CHECKED - 1)];

const useTraceHighlightState = () => {
    const highlight = useVar<string>("astarHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.7 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("astarHighlight", id),
            onPointerLeave: () => setVar("astarHighlight", ""),
        }),
    };
};

function AStarTraceDrawing() {
    const setVar = useSetVar();
    const step = clampStep(useVar<number>("astarStep", DEFAULT_ASTAR_STEP));
    const { opacity, weight, isActive, hoverProps } = useTraceHighlightState();
    const svgRef = useRef<SVGSVGElement>(null);

    const done = step >= ASTAR_CHECKED;
    const snapshot = snapshotAt(step);
    const next = snapshot.pick;
    const checked = ASTAR_TRACE.slice(0, step).map((entry) => entry.pick);
    const offered = done ? [] : snapshot.open.filter((entry) => entry.cell !== next.cell);
    const checkedIndex = new Map(checked.map((entry, index) => [`${entry.cell[0]},${entry.cell[1]}`, index]));

    // The formula block and the prose read the pick's score through \val{} and the store.
    useEffect(() => {
        setVar("astarNextG", next.g);
        setVar("astarNextH", next.h);
        setVar("astarNextF", next.f);
    }, [next.g, next.h, next.f, setVar]);

    // Click the ringed square to let A* check it; click a checked square to
    // wind the search back to the moment just before it was checked.
    const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        const y = ((event.clientY - rect.top) / rect.height) * TRACE_VIEW_HEIGHT;
        const col = Math.floor((x - GRID_X) / CELL);
        const row = Math.floor((y - GRID_Y) / CELL);
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
        setVar("astarPlaying", false);
        if (!done && col === next.cell[0] && row === next.cell[1]) {
            setVar("astarStep", step + 1);
            return;
        }
        const index = checkedIndex.get(`${col},${row}`);
        if (index !== undefined) setVar("astarStep", index);
    };

    const labelStyle = LABEL_OUTLINE as React.CSSProperties;
    const numberStyle = { fontVariantNumeric: "tabular-nums", ...EASE_150 } as React.CSSProperties;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${TRACE_VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="The hospital floor with the squares A* has checked so far, each showing its score, and the candidate squares it is choosing between"
            style={{ cursor: "pointer", touchAction: "manipulation" }}
            onClick={handleClick}
        >
            <defs>
                <filter id="astar-trace-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Readouts: the running count, and the score of the square being chosen. */}
            <g fontSize="12" style={numberStyle}>
                <text x="24" y="32" fill={TOTAL_TEXT} opacity={opacity("traceChecked")}>
                    {`A* has checked ${step} ${step === 1 ? "square" : "squares"}`}
                </text>
                {/* Kept clear of the play and reset icons in the top-right corner. */}
                <text x={VIEW_WIDTH - 104} y="32" textAnchor="end" fill={INK} opacity={opacity("traceNext")}>
                    {done ? "nurse reached: " : "next pick: "}
                    <tspan fill={WALKED_TEXT} fontWeight={600}>{next.g}</tspan>
                    {" + "}
                    <tspan fill={GUESS_TEXT} fontWeight={600}>{next.h}</tspan>
                    {" = "}
                    <tspan fill={TOTAL_TEXT} fontWeight={600}>{next.f}</tspan>
                </text>
            </g>

            {/* The room. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                {Array.from({ length: GRID_ROWS }, (_, row) =>
                    Array.from({ length: GRID_COLS }, (_, col) => (
                        <rect
                            key={`trace-floor-${col}-${row}`}
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

            {/* CHECKED — every square A* has already looked at, stamped with its total. */}
            <g {...hoverProps("traceChecked")} opacity={opacity("traceChecked")} style={EASE_150}>
                {checked.map((entry) => (
                    <rect
                        key={`trace-checked-${entry.cell[0]}-${entry.cell[1]}`}
                        x={cellX(entry.cell[0])}
                        y={cellY(entry.cell[1])}
                        width={CELL}
                        height={CELL}
                        fill={ACCENT}
                        fillOpacity={isActive("traceChecked") ? 0.45 : 0.28}
                        stroke={ACCENT}
                        strokeWidth="1"
                    />
                ))}
                {/* Once the nurse is reached, the route A* hands back — under the numbers. */}
                {done && (
                    <path d={pathFor(ASTAR_ROUTE)} fill="none" stroke={ACCENT} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                )}
                <g
                    fontSize="10"
                    fontWeight={600}
                    textAnchor="middle"
                    fill={TOTAL_TEXT}
                    style={{ ...numberStyle, ...(done ? { ...LABEL_OUTLINE, strokeWidth: 2.5 } : {}) } as React.CSSProperties}
                >
                    {checked.map((entry) => (
                        <text key={`trace-checked-f-${entry.cell[0]}-${entry.cell[1]}`} x={centreX(entry.cell[0])} y={centreY(entry.cell[1]) + 3.5}>
                            {entry.f}
                        </text>
                    ))}
                </g>
            </g>

            {/* ON OFFER — the squares A* could check next, each with its total. */}
            <g {...hoverProps("traceOffered")} opacity={opacity("traceOffered")} style={EASE_150}>
                {offered.map((entry) => (
                    <rect
                        key={`trace-offered-${entry.cell[0]}-${entry.cell[1]}`}
                        x={cellX(entry.cell[0]) + 1}
                        y={cellY(entry.cell[1]) + 1}
                        width={CELL - 2}
                        height={CELL - 2}
                        fill={ACCENT}
                        fillOpacity={isActive("traceOffered") ? 0.18 : 0.06}
                        stroke={ACCENT}
                        strokeWidth={weight("traceOffered", 1.5)}
                        strokeDasharray="3 3"
                    />
                ))}
                <g fontSize="10" textAnchor="middle" fill={isActive("traceOffered") ? TOTAL_TEXT : "#64748B"} style={numberStyle}>
                    {offered.map((entry) => (
                        <text key={`trace-offered-f-${entry.cell[0]}-${entry.cell[1]}`} x={centreX(entry.cell[0])} y={centreY(entry.cell[1]) + 3.5}>
                            {entry.f}
                        </text>
                    ))}
                </g>
            </g>

            {/* NEXT — the smallest total on offer, ringed: click it and A* checks it. */}
            {!done && (
                <g {...hoverProps("traceNext")} opacity={opacity("traceNext")} style={EASE_150}>
                    <Halo active={isActive("traceNext")}>
                        <rect
                            x={cellX(next.cell[0])}
                            y={cellY(next.cell[1])}
                            width={CELL}
                            height={CELL}
                            fill="none"
                            stroke={ACCENT}
                            strokeWidth={weight("traceNext", 3) + 6}
                        />
                    </Halo>
                    <rect
                        x={cellX(next.cell[0])}
                        y={cellY(next.cell[1])}
                        width={CELL}
                        height={CELL}
                        fill={ACCENT}
                        fillOpacity={0.18}
                        stroke={ACCENT}
                        strokeWidth={weight("traceNext", 3)}
                        filter="url(#astar-trace-shadow)"
                    />
                    <text
                        x={centreX(next.cell[0])}
                        y={centreY(next.cell[1]) + 3.5}
                        fontSize="10"
                        fontWeight={700}
                        textAnchor="middle"
                        fill={TOTAL_TEXT}
                        style={numberStyle}
                    >
                        {next.f}
                    </text>
                </g>
            )}

            {/* The two people, drawn last so nothing buries them. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <circle cx={centreX(ROBOT[0])} cy={centreY(ROBOT[1])} r="8" fill={ROBOT_FILL} stroke={ROBOT_EDGE} strokeWidth="2" filter="url(#astar-trace-shadow)" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="8" fill="#FFFFFF" stroke={NURSE_RING} strokeWidth="2.5" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="3" fill={NURSE_RING} />
                <g fontSize="11" fontWeight={600} textAnchor="middle" style={labelStyle}>
                    <text x={centreX(ROBOT[0])} y={centreY(ROBOT[1]) - 16} fill={ROBOT_EDGE}>robot</text>
                    <text x={centreX(NURSE[0])} y={centreY(NURSE[1]) - 16} fill={NURSE_TEXT}>nurse</text>
                </g>
            </g>

            <text x={VIEW_WIDTH / 2} y={TRACE_VIEW_HEIGHT - 10} fontSize="12" textAnchor="middle" fill={INK} style={EASE_150}>
                {done
                    ? `Nurse reached after ${ASTAR_CHECKED} squares, with a ${ROUTE_LENGTH}-step route.`
                    : `${offered.length + 1} squares on offer; the ringed one has the smallest total.`}
            </text>
        </svg>
    );
}

function AStarTraceFigure() {
    const setVar = useSetVar();
    const step = clampStep(useVar<number>("astarStep", DEFAULT_ASTAR_STEP));
    const playing = useVar<boolean>("astarPlaying", false);
    const sinceLastCheck = useRef(0);

    useRafLoop(
        (dt) => {
            sinceLastCheck.current += dt;
            if (sinceLastCheck.current < ASTAR_PLAY_PERIOD) return;
            sinceLastCheck.current = 0;
            if (step >= ASTAR_CHECKED) {
                setVar("astarPlaying", false);
                return;
            }
            setVar("astarStep", step + 1);
        },
        { paused: !playing },
    );

    // The hint is positioned within the whole figure shell (drawing + slider row
    // + hint strip), so the drawing's share of the height is scaled down.
    const done = step >= ASTAR_CHECKED;
    const next = snapshotAt(step).pick;
    const hintX = `${((centreX(next.cell[0]) / VIEW_WIDTH) * 100).toFixed(1)}%`;
    const hintY = `${((centreY(next.cell[1]) / (TRACE_VIEW_HEIGHT * HINT_SHELL_RATIO)) * 100).toFixed(1)}%`;

    return (
        <Figure
            id="astar-trace"
            playable
            playVarName="astarPlaying"
            onReset={() => {
                sinceLastCheck.current = 0;
                setVar("astarPlaying", false);
                setVar("astarStep", 0);
                setVar("astarHighlight", "");
            }}
            caption="A* replayed one decision at a time. Every square on offer shows its total; the ringed one is the smallest. Click it to let A* check it, click any checked square to wind back to that moment, or press play."
        >
            <AStarTraceDrawing />
            <div className="px-6 pb-5">
                <FigureSlider
                    varName="astarStep"
                    label="Squares checked"
                    {...numberPropsFromDefinition(getVariableInfo('astarStep'))}
                    formatValue={(value) => `${value} of ${ASTAR_CHECKED}`}
                />
            </div>
            {!done && (
                <InteractionHintSequence
                    hintKey="astar-trace-click"
                    steps={[
                        {
                            gesture: "click",
                            label: "Click the ringed square to let A* check it",
                            position: { x: hintX, y: hintY },
                        },
                    ]}
                />
            )}
        </Figure>
    );
}

/** The score of the square being chosen, in prose, straight from the trace. */
function AStarNextScore() {
    const step = clampStep(useVar<number>("astarStep", DEFAULT_ASTAR_STEP));
    const next = snapshotAt(step).pick;
    return (
        <InlineFormula
            latex={`\\clr{f}{f} = \\clr{g}{${next.g}} + \\clr{h}{${next.h}} = \\clr{f}{${next.f}}`}
            colorMap={FORMULA_COLORS}
        />
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
                A* scores every square it might check with two numbers added together: the{" "}
                <InlineSpotColor varName="astarNextG" {...spotColorPropsFromDefinition(getVariableInfo('astarNextG'))}>
                    steps already walked
                </InlineSpotColor>{" "}
                to get there, plus the{" "}
                <InlineSpotColor varName="astarNextH" {...spotColorPropsFromDefinition(getVariableInfo('astarNextH'))}>
                    guess of the steps still to come
                </InlineSpotColor>
                . It always checks the square with the{" "}
                <InlineSpotColor varName="astarNextF" {...spotColorPropsFromDefinition(getVariableInfo('astarNextF'))}>
                    smallest total
                </InlineSpotColor>{" "}
                next. A square behind the <RobotWord /> scores badly because the walk there was wasted, and a far-off
                square scores badly because its guess is large.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-formula" maxWidth="xl">
        <Block id="comparison-formula" padding="lg">
            <FormulaBlock
                latex="\clr{f}{f} = \clr{g}{g} + \clr{h}{h}"
                colorMap={FORMULA_COLORS}
            />
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
                Adding the guess never bought a shorter route: the{" "}
                <InlineSpotColor varName="astarNextG" {...spotColorPropsFromDefinition(getVariableInfo('astarNextG'))}>
                    walked-distance
                </InlineSpotColor>{" "}
                half of the score still refuses to let a longer one win. What it bought is the search, which
                stopped wandering backwards and leaned towards the <NurseWord />. Same route,{" "}
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

    <StackLayout key="layout-comparison-trace-intro" maxWidth="xl">
        <Block id="comparison-trace-intro" padding="sm">
            <EditableParagraph id="para-comparison-trace-intro" blockId="comparison-trace-intro">
                To see how, replay the search one decision at a time. So far A* has checked{" "}
                <InlineScrubbleNumber
                    varName="astarStep"
                    {...numberPropsFromDefinition(getVariableInfo('astarStep'))}
                />{" "}
                squares, each stamped with the{" "}
                <InlineLinkedHighlight
                    varName="astarHighlight"
                    highlightId="traceChecked"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('astarHighlight'))}
                >
                    total it was chosen by
                </InlineLinkedHighlight>
                . Around the edge sit the{" "}
                <InlineLinkedHighlight
                    varName="astarHighlight"
                    highlightId="traceOffered"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('astarHighlight'))}
                >
                    squares on offer
                </InlineLinkedHighlight>
                , and the{" "}
                <InlineLinkedHighlight
                    varName="astarHighlight"
                    highlightId="traceNext"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('astarHighlight'))}
                >
                    ringed one
                </InlineLinkedHighlight>{" "}
                is the square it checks next, because it scores <AStarNextScore />, the smallest total on offer.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-trace" maxWidth="xl">
        <Block id="comparison-trace" padding="sm" hasVisualization>
            <AStarTraceFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-trace-formula" maxWidth="xl">
        <Block id="comparison-trace-formula" padding="lg">
            <FormulaBlock
                latex="\clr{f}{f} = \clr{g}{g} + \clr{h}{h} \qquad \val{astarNextF} = \val{astarNextG} + \val{astarNextH}"
                colorMap={FORMULA_COLORS}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-comparison-trace-reading" maxWidth="xl">
        <Block id="comparison-trace-reading" padding="sm">
            <EditableParagraph id="para-comparison-trace-reading" blockId="comparison-trace-reading">
                Watch the two halves pull against each other. Squares back near the <RobotWord /> keep a small{" "}
                <InlineSpotColor varName="astarNextG" {...spotColorPropsFromDefinition(getVariableInfo('astarNextG'))}>
                    walked distance
                </InlineSpotColor>{" "}
                but a large{" "}
                <InlineSpotColor varName="astarNextH" {...spotColorPropsFromDefinition(getVariableInfo('astarNextH'))}>
                    guess
                </InlineSpotColor>
                ; squares out past the wall have walked further but guess less. Whenever the totals tie, A* takes
                the smaller guess, which is why it leans towards the <NurseWord /> instead of filling the room ring by
                ring, and why the far corners of the map never get checked at all.
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
                                    position: { x: "56%", y: "80%" },
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
