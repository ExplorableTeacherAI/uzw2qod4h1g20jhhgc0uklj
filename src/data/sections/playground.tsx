import React, { useMemo, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph, InlineToggle, InlineTrigger, InteractionHintSequence } from "@/components/atoms";
import { Figure, FigureSlider } from "@/components/molecules";
import { useSetVar, useVar, useVariableStore } from "@/stores";
import { clamp, useRafLoop } from "@/lib/motion";
import { type Cell, type Floor, type SearchMode, cellKey, solve } from "./searchEngine";
import { GRID_COLS, GRID_ROWS } from "./hospitalFloorModel";
import {
    EASE_150,
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
import { getVariableInfo, numberPropsFromDefinition, togglePropsFromDefinition } from "../variables";
import { LivePill, NurseWord, RobotWord } from "./actors";

// ── View geometry — the same frame as the A* step-through ────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 356;
const CELL = 30;
const GRID_X = 85;
const GRID_Y = 56;

const cellX = (col: number) => GRID_X + col * CELL;
const cellY = (row: number) => GRID_Y + row * CELL;
const centreX = (col: number) => cellX(col) + CELL / 2;
const centreY = (row: number) => cellY(row) + CELL / 2;

const pathFor = (cells: Cell[]) =>
    cells.map(([col, row], index) => `${index === 0 ? "M" : "L"} ${centreX(col)} ${centreY(row)}`).join(" ");

/** Walls live in the store as cell indices, so they survive as a plain number[]. */
const wallIndex = (col: number, row: number) => row * GRID_COLS + col;
const MAX_STEP = GRID_COLS * GRID_ROWS;
/** Seconds between checks when the playground plays. */
const PLAY_PERIOD = 0.25;

const DEFAULT_WALLS = getVariableInfo('playgroundWalls')?.defaultValue as number[];
const DEFAULT_ROBOT = getVariableInfo('playgroundRobot')?.defaultValue as number[];
const DEFAULT_NURSE = getVariableInfo('playgroundNurse')?.defaultValue as number[];

const asCell = (value: number[] | undefined, fallback: number[]): Cell => {
    const source = Array.isArray(value) && value.length === 2 ? value : fallback;
    return [source[0], source[1]];
};

/** Everything the figure and the prose need, derived once from the store. */
const usePlayground = () => {
    const wallList = useVar<number[]>("playgroundWalls", DEFAULT_WALLS);
    const robotValue = useVar<number[]>("playgroundRobot", DEFAULT_ROBOT);
    const nurseValue = useVar<number[]>("playgroundNurse", DEFAULT_NURSE);
    const modeLabel = useVar<string>("playgroundMode", "A*");
    const mode: SearchMode = modeLabel === "A*" ? "astar" : "blind";

    const floor = useMemo<Floor>(() => {
        const walls = new Set<string>();
        for (const index of wallList) walls.add(cellKey(index % GRID_COLS, Math.floor(index / GRID_COLS)));
        return { cols: GRID_COLS, rows: GRID_ROWS, walls, robot: asCell(robotValue, DEFAULT_ROBOT), nurse: asCell(nurseValue, DEFAULT_NURSE) };
    }, [wallList, robotValue, nurseValue]);

    const result = useMemo(() => solve(floor, mode), [floor, mode]);
    const astarResult = useMemo(() => (mode === "astar" ? result : solve(floor, "astar")), [floor, mode, result]);
    const blindResult = useMemo(() => (mode === "blind" ? result : solve(floor, "blind")), [floor, mode, result]);

    return { floor, mode, modeLabel, result, astarResult, blindResult, wallList };
};

// ── The drawing ──────────────────────────────────────────────────────────────

function PlaygroundDrawing() {
    const setVar = useSetVar();
    const { floor, mode, result, wallList } = usePlayground();
    const rawStep = useVar<number>("playgroundStep", MAX_STEP);
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<"robot" | "nurse" | null>(null);
    const gestureRef = useRef<{ kind: "robot" | "nurse" | "paint"; paintTo: boolean } | null>(null);

    const accent = mode === "astar" ? TOTAL : WALKED;
    const accentText = mode === "astar" ? TOTAL_TEXT : WALKED_TEXT;
    const scoreOf = (entry: { g: number; f: number }) => (mode === "astar" ? entry.f : entry.g);

    const total = result.trace.length;
    const step = clamp(Math.round(rawStep), 0, total);
    const done = step >= total;
    const checked = result.trace.slice(0, step).map((entry) => entry.pick);
    const snapshot = done ? null : result.trace[step];
    const next = snapshot?.pick ?? null;
    const offered = snapshot ? snapshot.open.filter((entry) => entry.cell !== snapshot.pick.cell) : [];

    // ── editing the floor ──
    const cellFromPointer = (event: React.PointerEvent<SVGSVGElement>): Cell | null => {
        const svg = svgRef.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        const y = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
        const col = Math.floor((x - GRID_X) / CELL);
        const row = Math.floor((y - GRID_Y) / CELL);
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
        return [col, row];
    };
    const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

    // Any change to the floor shows the finished search for the new floor.
    const touchFloor = () => {
        setVar("playgroundPlaying", false);
        setVar("playgroundStep", MAX_STEP);
    };
    const setWall = (cell: Cell, wall: boolean) => {
        if (same(cell, floor.robot) || same(cell, floor.nurse)) return;
        const index = wallIndex(cell[0], cell[1]);
        const has = wallList.includes(index);
        if (has === wall) return;
        setVar("playgroundWalls", wall ? [...wallList, index] : wallList.filter((value) => value !== index));
        touchFloor();
    };
    const movePerson = (kind: "robot" | "nurse", cell: Cell) => {
        const other = kind === "robot" ? floor.nurse : floor.robot;
        const current = kind === "robot" ? floor.robot : floor.nurse;
        if (same(cell, current) || same(cell, other) || floor.walls.has(cellKey(cell[0], cell[1]))) return;
        setVar(kind === "robot" ? "playgroundRobot" : "playgroundNurse", [cell[0], cell[1]]);
        touchFloor();
    };

    const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
        const cell = cellFromPointer(event);
        if (!cell) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (same(cell, floor.robot)) {
            gestureRef.current = { kind: "robot", paintTo: false };
            setDragging("robot");
        } else if (same(cell, floor.nurse)) {
            gestureRef.current = { kind: "nurse", paintTo: false };
            setDragging("nurse");
        } else {
            const paintTo = !floor.walls.has(cellKey(cell[0], cell[1]));
            gestureRef.current = { kind: "paint", paintTo };
            setWall(cell, paintTo);
        }
    };
    const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        const gesture = gestureRef.current;
        if (!gesture) return;
        const cell = cellFromPointer(event);
        if (!cell) return;
        if (gesture.kind === "paint") setWall(cell, gesture.paintTo);
        else movePerson(gesture.kind, cell);
    };
    const endGesture = () => {
        gestureRef.current = null;
        setDragging(null);
    };

    const labelStyle = LABEL_OUTLINE as React.CSSProperties;
    const numberStyle = { fontVariantNumeric: "tabular-nums", ...EASE_150 } as React.CSSProperties;
    const searchName = mode === "astar" ? "A*" : "the blind search";

    const statusLine = !result.reached && done
        ? "The nurse cannot be reached from there: every way is walled off."
        : done
          ? `${searchName === "A*" ? "A*" : "The blind search"} reached the nurse after ${total} squares, with a ${result.route.length - 1}-step route.`
          : `${offered.length + 1} squares on offer; the ringed one is checked next.`;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="An editable floor: click or drag to paint walls, drag the robot and the nurse, and watch the chosen search run"
            style={{ cursor: dragging ? "grabbing" : "crosshair", touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
        >
            <defs>
                <filter id="playground-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g fontSize="12" style={numberStyle}>
                <text x="24" y="32" fill={accentText}>
                    {`${searchName === "A*" ? "A*" : "blind search"}: ${step} ${step === 1 ? "square" : "squares"} checked`}
                </text>
                <text x={VIEW_WIDTH - 104} y="32" textAnchor="end" fill={INK}>
                    {next ? (
                        mode === "astar" ? (
                            <>
                                {"next pick: "}
                                <tspan fill={WALKED_TEXT} fontWeight={600}>{next.g}</tspan>
                                {" + "}
                                <tspan fill="#C27803" fontWeight={600}>{next.h}</tspan>
                                {" = "}
                                <tspan fill={TOTAL_TEXT} fontWeight={600}>{next.f}</tspan>
                            </>
                        ) : (
                            <>
                                {"next pick: "}
                                <tspan fill={WALKED_TEXT} fontWeight={600}>{`${next.g} steps out`}</tspan>
                            </>
                        )
                    ) : result.reached ? (
                        `route: ${result.route.length - 1} steps`
                    ) : (
                        "no route"
                    )}
                </text>
            </g>

            {/* The floor: open squares, then walls. */}
            {Array.from({ length: GRID_ROWS }, (_, row) =>
                Array.from({ length: GRID_COLS }, (_, col) => {
                    const wall = floor.walls.has(cellKey(col, row));
                    return (
                        <rect
                            key={`playground-floor-${col}-${row}`}
                            x={cellX(col)}
                            y={cellY(row)}
                            width={CELL}
                            height={CELL}
                            fill={wall ? WALL_FILL : "#FFFFFF"}
                            stroke={wall ? WALL_FILL : INK_QUIET}
                            strokeWidth="1"
                            style={EASE_150}
                        />
                    );
                }),
            )}

            {/* CHECKED — every square the search has looked at, stamped with its score. */}
            {checked.map((entry) => (
                <rect
                    key={`playground-checked-${entry.cell[0]}-${entry.cell[1]}`}
                    x={cellX(entry.cell[0])}
                    y={cellY(entry.cell[1])}
                    width={CELL}
                    height={CELL}
                    fill={accent}
                    fillOpacity={0.28}
                    stroke={accent}
                    strokeWidth="1"
                />
            ))}
            {result.reached && done && (
                <path d={pathFor(result.route)} fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
            <g
                fontSize="10"
                fontWeight={600}
                textAnchor="middle"
                fill={accentText}
                style={{ ...numberStyle, ...(done ? { ...LABEL_OUTLINE, strokeWidth: 2.5 } : {}) } as React.CSSProperties}
            >
                {checked.map((entry) => (
                    <text key={`playground-score-${entry.cell[0]}-${entry.cell[1]}`} x={centreX(entry.cell[0])} y={centreY(entry.cell[1]) + 3.5}>
                        {scoreOf(entry)}
                    </text>
                ))}
            </g>

            {/* ON OFFER — the candidates, and the ringed next pick. */}
            {offered.map((entry) => (
                <g key={`playground-offered-${entry.cell[0]}-${entry.cell[1]}`}>
                    <rect
                        x={cellX(entry.cell[0]) + 1}
                        y={cellY(entry.cell[1]) + 1}
                        width={CELL - 2}
                        height={CELL - 2}
                        fill={accent}
                        fillOpacity={0.06}
                        stroke={accent}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                    />
                    <text x={centreX(entry.cell[0])} y={centreY(entry.cell[1]) + 3.5} fontSize="10" textAnchor="middle" fill="#64748B" style={numberStyle}>
                        {scoreOf(entry)}
                    </text>
                </g>
            ))}
            {next && (
                <g>
                    <rect
                        x={cellX(next.cell[0])}
                        y={cellY(next.cell[1])}
                        width={CELL}
                        height={CELL}
                        fill={accent}
                        fillOpacity={0.18}
                        stroke={accent}
                        strokeWidth="3"
                    />
                    <text x={centreX(next.cell[0])} y={centreY(next.cell[1]) + 3.5} fontSize="10" fontWeight={700} textAnchor="middle" fill={accentText} style={numberStyle}>
                        {scoreOf(next)}
                    </text>
                </g>
            )}

            {/* The two people — draggable. */}
            <g style={{ cursor: dragging ? "grabbing" : "grab" }}>
                <circle cx={centreX(floor.robot[0])} cy={centreY(floor.robot[1])} r="10" fill={ROBOT_FILL} stroke={ROBOT_EDGE} strokeWidth="2" filter="url(#playground-shadow)" />
                <circle cx={centreX(floor.nurse[0])} cy={centreY(floor.nurse[1])} r="10" fill="#FFFFFF" stroke={NURSE_RING} strokeWidth="3" filter="url(#playground-shadow)" />
                <circle cx={centreX(floor.nurse[0])} cy={centreY(floor.nurse[1])} r="3.5" fill={NURSE_RING} />
            </g>
            <g fontSize="11" fontWeight={600} textAnchor="middle" style={labelStyle}>
                <text x={centreX(floor.robot[0])} y={centreY(floor.robot[1]) - 17} fill={ROBOT_EDGE}>robot</text>
                <text x={centreX(floor.nurse[0])} y={centreY(floor.nurse[1]) - 17} fill={NURSE_TEXT}>nurse</text>
            </g>

            <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 10} fontSize="12" textAnchor="middle" fill={INK} style={EASE_150}>
                {statusLine}
            </text>
        </svg>
    );
}

// ── Figure shell ─────────────────────────────────────────────────────────────

function PlaygroundFigure() {
    const setVar = useSetVar();
    const { result } = usePlayground();
    const total = result.trace.length;
    const rawStep = useVar<number>("playgroundStep", MAX_STEP);
    const step = clamp(Math.round(rawStep), 0, total);
    const playing = useVar<boolean>("playgroundPlaying", false);
    const sinceLastCheck = useRef(0);

    useRafLoop(
        (dt) => {
            sinceLastCheck.current += dt;
            if (sinceLastCheck.current < PLAY_PERIOD) return;
            sinceLastCheck.current = 0;
            // Pressing play on a finished search starts it again from the beginning.
            if (step >= total) {
                if (rawStep >= MAX_STEP) setVar("playgroundStep", 0);
                else setVar("playgroundPlaying", false);
                return;
            }
            setVar("playgroundStep", step + 1);
        },
        { paused: !playing },
    );

    return (
        <Figure
            id="playground-floor"
            playable
            playVarName="playgroundPlaying"
            onReset={() => {
                sinceLastCheck.current = 0;
                useVariableStore.getState().setVariables({
                    playgroundPlaying: false,
                    playgroundWalls: [...DEFAULT_WALLS],
                    playgroundRobot: [...DEFAULT_ROBOT],
                    playgroundNurse: [...DEFAULT_NURSE],
                    playgroundStep: MAX_STEP,
                });
            }}
            caption="Your floor. Click or drag across squares to paint walls (drag over a wall to erase it), drag the robot and the nurse wherever you like, and the search reruns at once. Press play, or wind the slider back, to watch it choose square by square."
        >
            <PlaygroundDrawing />
            <div className="px-6 pb-5">
                <FigureSlider
                    varName="playgroundStep"
                    label="Squares checked"
                    {...numberPropsFromDefinition(getVariableInfo('playgroundStep'))}
                    max={Math.max(total, 1)}
                    formatValue={(value) => `${Math.min(Math.round(value), total)} of ${total}`}
                />
            </div>
            <InteractionHintSequence
                hintKey="playground-paint-walls"
                steps={[
                    {
                        gesture: "drag",
                        label: "Drag across squares to paint a wall",
                        position: { x: "62%", y: "26%" },
                        dragPath: { type: "line", startOffset: { x: 0, y: -20 }, endOffset: { x: 0, y: 24 } },
                    },
                ]}
            />
        </Figure>
    );
}

/** Both searches' costs on the current floor, in prose. */
function PlaygroundComparison() {
    const { astarResult, blindResult } = usePlayground();
    if (!astarResult.reached) {
        return <>On this floor the <NurseWord /> cannot be reached at all, so both searches check every square they can get to and give up.</>;
    }
    return (
        <>
            On this floor A* checks <LivePill color={TOTAL}>{`${astarResult.trace.length} squares`}</LivePill> and the blind
            search checks <LivePill color={WALKED}>{`${blindResult.trace.length} squares`}</LivePill>, and both hand back a
            route of <LivePill color={TOTAL}>{`${astarResult.route.length - 1} steps`}</LivePill>.
        </>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export const playgroundBlocks: ReactElement[] = [
    <StackLayout key="layout-playground-heading" maxWidth="xl">
        <Block id="playground-heading" padding="md">
            <EditableH2 id="h2-playground-heading" blockId="playground-heading">
                Playground
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-playground-intro" maxWidth="xl">
        <Block id="playground-intro" padding="sm">
            <EditableParagraph id="para-playground-intro" blockId="playground-intro">
                Now the floor is yours. Paint walls, knock them down, move the <RobotWord /> and the <NurseWord />,
                and watch{" "}
                <InlineToggle
                    id="toggle-playground-mode"
                    varName="playgroundMode"
                    options={["A*", "the blind search"]}
                    {...togglePropsFromDefinition(getVariableInfo('playgroundMode'))}
                />{" "}
                run on it. Click that name to switch searches. Try walling the nurse into a pocket that opens away
                from the robot, or putting her right behind a long wall, and see how much of the room each search
                has to look at.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-playground-figure" maxWidth="xl">
        <Block id="playground-figure" padding="sm" hasVisualization>
            <PlaygroundFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-playground-comparison" maxWidth="xl">
        <Block id="playground-comparison" padding="sm">
            <EditableParagraph id="para-playground-comparison" blockId="playground-comparison">
                <PlaygroundComparison /> The route is the same length whichever search you run; only the searching
                changes. When you want the hospital back, you can{" "}
                <InlineTrigger
                    varName="playgroundStep"
                    value={MAX_STEP}
                    icon="refresh"
                    onTrigger={() =>
                        useVariableStore.getState().setVariables({
                            playgroundPlaying: false,
                            playgroundWalls: [...DEFAULT_WALLS],
                            playgroundRobot: [...DEFAULT_ROBOT],
                            playgroundNurse: [...DEFAULT_NURSE],
                        })
                    }
                >
                    restore the original floor
                </InlineTrigger>
                , or{" "}
                <InlineTrigger
                    varName="playgroundStep"
                    value={MAX_STEP}
                    icon="zap"
                    onTrigger={() => useVariableStore.getState().setVariables({ playgroundPlaying: false, playgroundWalls: [] })}
                >
                    clear every wall
                </InlineTrigger>{" "}
                and start from an empty room.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
