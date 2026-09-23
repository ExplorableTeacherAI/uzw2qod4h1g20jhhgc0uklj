import React, { useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH1,
    EditableParagraph,
    InlineLinkedHighlight,
    InlineSpotColor,
    InlineTrigger,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useSetVar, useVar } from "@/stores";
import {
    BLIND_ROUTE,
    GRID_COLS,
    GRID_ROWS,
    inGrid,
    isWall,
    NURSE,
    ROBOT,
    ROUTE_LENGTH,
} from "./hospitalFloorModel";
import {
    EASE_150,
    GUESS,
    INK,
    INK_QUIET,
    LABEL_OUTLINE,
    TOTAL,
    TOTAL_TEXT,
    WALKED,
    WALKED_TEXT,
    WALL_FILL,
} from "./lessonPalette";
import { getVariableInfo, linkedHighlightPropsFromDefinition, spotColorPropsFromDefinition } from "../variables";

// ── View geometry — the same frame as the comparison map later on ────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 356;
const CELL = 30;
const GRID_X = 85;
const GRID_Y = 56;

const cellX = (col: number) => GRID_X + col * CELL;
const cellY = (row: number) => GRID_Y + row * CELL;
const centreX = (col: number) => cellX(col) + CELL / 2;
const centreY = (row: number) => cellY(row) + CELL / 2;

const pathFor = (cells: [number, number][]) =>
    cells.map(([col, row], index) => `${index === 0 ? "M" : "L"} ${centreX(col)} ${centreY(row)}`).join(" ");

const formatSteps = (count: number) => `${count} ${count === 1 ? "step" : "steps"}`;

// ── Shared highlight ─────────────────────────────────────────────────────────

const useHighlightState = () => {
    const highlight = useVar<string>("introHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.7 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("introHighlight", id),
            onPointerLeave: () => setVar("introHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

// ── The drawing: the floor, and a route the student draws by hand ────────────

function RouteDrawing({
    route,
    onExtend,
    onStepBack,
}: {
    route: [number, number][];
    onExtend: (col: number, row: number) => void;
    onStepBack: () => void;
}) {
    const { opacity, weight, isActive, hoverProps } = useHighlightState();
    const showShortest = useVar<boolean>("introShowShortest", false);
    const svgRef = useRef<SVGSVGElement>(null);
    const drawingRef = useRef(false);

    const [headCol, headRow] = route[route.length - 1];
    const reached = headCol === NURSE[0] && headRow === NURSE[1];
    const visited = new Set(route.map(([c, r]) => `${c},${r}`));

    const cellFromPointer = (event: React.PointerEvent<SVGSVGElement>): [number, number] | null => {
        const svg = svgRef.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        const y = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
        const col = Math.floor((x - GRID_X) / CELL);
        const row = Math.floor((y - GRID_Y) / CELL);
        return inGrid(col, row) ? [col, row] : null;
    };

    // A square joins the route when it is next to the head, open, and new;
    // the square just behind the head takes the route back one step.
    const visit = (cell: [number, number] | null) => {
        if (!cell) return;
        const [col, row] = cell;
        const previous = route[route.length - 2];
        if (previous && previous[0] === col && previous[1] === row) {
            onStepBack();
            return;
        }
        if (reached || isWall(col, row) || visited.has(`${col},${row}`)) return;
        if (Math.abs(col - headCol) + Math.abs(row - headRow) !== 1) return;
        onExtend(col, row);
    };

    const labelStyle = LABEL_OUTLINE as React.CSSProperties;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="Hospital floor grid with walls, a robot and a nurse; drag from the robot across open squares to draw a route to the nurse"
            style={{ cursor: "crosshair", touchAction: "none" }}
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drawingRef.current = true;
                visit(cellFromPointer(event));
            }}
            onPointerMove={(event) => {
                if (!drawingRef.current) return;
                visit(cellFromPointer(event));
            }}
            onPointerUp={() => {
                drawingRef.current = false;
            }}
            onPointerCancel={() => {
                drawingRef.current = false;
            }}
        >
            <defs>
                <filter id="intro-route-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="32" fill={WALKED_TEXT} fontWeight={600} opacity={opacity("route")}>
                    {`your route: ${formatSteps(route.length - 1)}`}
                </text>
                <text x={VIEW_WIDTH - 24} y="32" fill={TOTAL_TEXT} textAnchor="end" opacity={opacity("shortest")}>
                    {showShortest ? `a shortest path: ${formatSteps(ROUTE_LENGTH)}` : `shortest possible: ${formatSteps(ROUTE_LENGTH)}`}
                </text>
            </g>

            {/* Open floor. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                {Array.from({ length: GRID_ROWS }, (_, row) =>
                    Array.from({ length: GRID_COLS }, (_, col) =>
                        isWall(col, row) ? null : (
                            <rect
                                key={`intro-floor-${col}-${row}`}
                                x={cellX(col)}
                                y={cellY(row)}
                                width={CELL}
                                height={CELL}
                                fill="#FFFFFF"
                                stroke={INK_QUIET}
                                strokeWidth="1"
                            />
                        ),
                    ),
                )}
            </g>

            {/* THE WALLS — the squares no route may cross. */}
            <g {...hoverProps("walls")} opacity={opacity("walls")} style={EASE_150}>
                {Array.from({ length: GRID_ROWS }, (_, row) =>
                    Array.from({ length: GRID_COLS }, (_, col) =>
                        isWall(col, row) ? (
                            <rect
                                key={`intro-wall-${col}-${row}`}
                                x={cellX(col)}
                                y={cellY(row)}
                                width={CELL}
                                height={CELL}
                                fill={WALL_FILL}
                                stroke={isActive("walls") ? INK : WALL_FILL}
                                strokeWidth={isActive("walls") ? 3 : 1}
                            />
                        ) : null,
                    ),
                )}
            </g>

            {/* A SHORTEST PATH — shown only when asked for, for comparison. */}
            {showShortest && (
                <g {...hoverProps("shortest")} opacity={opacity("shortest")} style={EASE_150}>
                    <Halo active={isActive("shortest")}>
                        <path d={pathFor(BLIND_ROUTE)} fill="none" stroke={TOTAL} strokeWidth={weight("shortest", 3) + 6} strokeLinecap="round" strokeLinejoin="round" />
                    </Halo>
                    <path
                        d={pathFor(BLIND_ROUTE)}
                        fill="none"
                        stroke={TOTAL}
                        strokeWidth={weight("shortest", 3)}
                        strokeDasharray="1 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>
            )}

            {/* YOUR ROUTE — every square the student's hand has crossed. */}
            <g {...hoverProps("route")} opacity={opacity("route")} style={EASE_150}>
                {route.map(([col, row]) => (
                    <rect
                        key={`intro-route-${col}-${row}`}
                        x={cellX(col)}
                        y={cellY(row)}
                        width={CELL}
                        height={CELL}
                        fill={WALKED}
                        fillOpacity={isActive("route") ? 0.32 : 0.16}
                        stroke="none"
                    />
                ))}
                {route.length > 1 && (
                    <>
                        <Halo active={isActive("route")}>
                            <path d={pathFor(route)} fill="none" stroke={WALKED} strokeWidth={weight("route", 3.5) + 6} strokeLinecap="round" strokeLinejoin="round" />
                        </Halo>
                        <path d={pathFor(route)} fill="none" stroke={WALKED} strokeWidth={weight("route", 3.5)} strokeLinecap="round" strokeLinejoin="round" />
                    </>
                )}
                {/* The pen: where the route currently ends. */}
                {!reached && route.length > 1 && (
                    <circle cx={centreX(headCol)} cy={centreY(headRow)} r="6" fill={WALKED} filter="url(#intro-route-shadow)" />
                )}
            </g>

            {/* The two people, drawn last so nothing buries them. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <circle cx={centreX(ROBOT[0])} cy={centreY(ROBOT[1])} r="8" fill={INK} filter="url(#intro-route-shadow)" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="8" fill="#FFFFFF" stroke={GUESS} strokeWidth="2.5" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="3" fill={GUESS} />
                <g fill={INK} fontSize="11" textAnchor="middle" style={labelStyle}>
                    <text x={centreX(ROBOT[0])} y={centreY(ROBOT[1]) - 16}>robot</text>
                    <text x={centreX(NURSE[0])} y={centreY(NURSE[1]) - 16}>nurse</text>
                </g>
            </g>

            <text
                x={VIEW_WIDTH / 2}
                y={VIEW_HEIGHT - 10}
                fontSize="12"
                fontWeight={600}
                textAnchor="middle"
                fill={reached && route.length - 1 === ROUTE_LENGTH ? TOTAL_TEXT : INK}
                opacity={reached ? 1 : 0}
                style={EASE_150}
            >
                {route.length - 1 === ROUTE_LENGTH
                    ? `Reached in ${formatSteps(route.length - 1)}: that is a shortest path.`
                    : `Reached in ${formatSteps(route.length - 1)}; a shortest path takes ${ROUTE_LENGTH}.`}
            </text>
        </svg>
    );
}

// ── Figure shell ─────────────────────────────────────────────────────────────

function RouteFigure() {
    const setVar = useSetVar();
    const [route, setRoute] = useState<[number, number][]>([ROBOT]);
    // The store re-renders synchronously, so the route is mirrored in a ref
    // and every update goes through it.
    const routeRef = useRef(route);

    const commit = (next: [number, number][]) => {
        routeRef.current = next;
        setRoute(next);
        const [col, row] = next[next.length - 1];
        setVar("introRouteSteps", next.length - 1);
        setVar("introRouteReached", col === NURSE[0] && row === NURSE[1]);
    };

    return (
        <Figure
            id="introduction-floor-plan"
            onReset={() => {
                commit([ROBOT]);
                setVar("introShowShortest", false);
                setVar("introHighlight", "");
            }}
            caption="The fourth floor as the robot sees it: open squares, walls, the robot and the nurse. Drag from the robot across open squares to draw a route to her (drag back over the last square to undo), and count what it costs."
        >
            <RouteDrawing
                route={route}
                onExtend={(col, row) => commit([...routeRef.current, [col, row]])}
                onStepBack={() => commit(routeRef.current.slice(0, -1))}
            />
            <InteractionHintSequence
                hintKey="introduction-route-drag"
                steps={[
                    {
                        gesture: "drag",
                        label: "Drag from the robot to draw a route to the nurse",
                        position: { x: "31%", y: "46%" },
                        dragPath: { type: "line", startOffset: { x: -6, y: 0 }, endOffset: { x: 44, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

/** The drawn route's cost, in prose, and how it compares with the shortest. */
function IntroRouteReport() {
    const steps = useVar<number>("introRouteSteps", 0);
    const reached = useVar<boolean>("introRouteReached", false);
    const stepsPill = (
        <InlineSpotColor varName="introRouteSteps" {...spotColorPropsFromDefinition(getVariableInfo('introRouteSteps'))}>
            {formatSteps(steps)}
        </InlineSpotColor>
    );
    if (!reached) {
        return <>Your route so far is {stepsPill} long and has not reached her yet.</>;
    }
    if (steps === ROUTE_LENGTH) {
        return <>Your route reaches her in {stepsPill}, and no route can do it in fewer: you found a shortest path.</>;
    }
    return (
        <>
            Your route reaches her in {stepsPill}, which is {steps - ROUTE_LENGTH} more than the {ROUTE_LENGTH} a
            shortest path needs.
        </>
    );
}

export const aStarIntroductionBlocks: ReactElement[] = [
    <StackLayout key="layout-introduction-title" maxWidth="xl">
        <Block id="introduction-title" padding="md">
            <EditableH1 id="h1-introduction-title" blockId="introduction-title">
                The A* Algorithm
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-introduction-hospital-scenario" maxWidth="xl">
        <Block id="introduction-hospital-scenario" padding="sm">
            <EditableParagraph id="para-introduction-hospital-scenario" blockId="introduction-hospital-scenario">
                A delivery robot is parked somewhere on the fourth floor of a hospital, and a nurse three
                corridors away needs a blood sample. The robot has a map of the building, cut into a grid of
                squares: some are open floor, some are{" "}
                <InlineLinkedHighlight
                    varName="introHighlight"
                    highlightId="walls"
                    color={INK}
                    bgColor="rgba(71, 85, 105, 0.18)"
                >
                    walls
                </InlineLinkedHighlight>
                . Its job is to find a shortest path, meaning a{" "}
                <InlineLinkedHighlight
                    varName="introHighlight"
                    highlightId="route"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('introHighlight'))}
                >
                    route
                </InlineLinkedHighlight>{" "}
                from where it stands to where it needs to be that crosses as few squares as possible. Try it
                yourself on the map below.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-introduction-floor-plan" maxWidth="xl">
        <Block id="introduction-floor-plan" padding="sm" hasVisualization>
            <RouteFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-introduction-route-report" maxWidth="xl">
        <Block id="introduction-route-report" padding="sm">
            <EditableParagraph id="para-introduction-route-report" blockId="introduction-route-report">
                <IntroRouteReport /> Every step costs the robot time, so the difference matters. If you want to
                compare, you can{" "}
                <InlineTrigger varName="introShowShortest" value={true} icon="zap">
                    show a shortest path
                </InlineTrigger>{" "}
                on the map. There is more than one{" "}
                <InlineLinkedHighlight
                    varName="introHighlight"
                    highlightId="shortest"
                    color={TOTAL}
                    bgColor="rgba(98, 208, 173, 0.22)"
                >
                    shortest path
                </InlineLinkedHighlight>
                , but none is shorter than {ROUTE_LENGTH} steps.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-introduction-promise" maxWidth="xl">
        <Block id="introduction-promise" padding="sm">
            <EditableParagraph id="para-introduction-promise" blockId="introduction-promise">
                Finding that route is easy for you, looking at the whole map at once. The robot cannot do that.
                It has to check squares one at a time, and checking costs time. Here we build up the A* algorithm,
                the method that decides which square to check next, and by the end you will be able to say why it
                gets away with checking so many fewer squares than the obvious approach.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
