import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineTooltip,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useSetVar, useVar } from "@/stores";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
} from "../variables";

// ── The floor plan model ─────────────────────────────────────────────────────
// Same room, but the walls now form a pocket that opens towards the robot: a
// guess-only walk marches straight into it and finds every way out uphill.

const GRID_COLS = 13;
const GRID_ROWS = 9;
const START: [number, number] = [2, 4];
const NURSE: [number, number] = [11, 4];

const WALLS: ReadonlySet<string> = new Set<string>([
    ...Array.from({ length: 5 }, (_, index) => `8,${index + 2}`),
    ...Array.from({ length: 4 }, (_, index) => `${index + 5},2`),
    ...Array.from({ length: 4 }, (_, index) => `${index + 5},6`),
]);

const isWall = (col: number, row: number) => WALLS.has(`${col},${row}`);
const inGrid = (col: number, row: number) =>
    col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;

/** The guess: steps to the nurse across an empty floor, walls ignored. */
const guessAt = (col: number, row: number) =>
    Math.abs(col - NURSE[0]) + Math.abs(row - NURSE[1]);

const neighboursOf = (col: number, row: number): [number, number][] =>
    ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
        .map(([dx, dy]) => [col + dx, row + dy] as [number, number])
        .filter(([nextCol, nextRow]) => inGrid(nextCol, nextRow) && !isWall(nextCol, nextRow));

// ── View geometry — the same frame as the floor plan in the previous section ─

const VIEW_WIDTH = 386;
const VIEW_HEIGHT = 316;
const CELL = 26;
const GRID_X = 24;
const GRID_Y = 52;

const INK = "#334155";
const INK_QUIET = "#CBD5E1";
const GUESS_INK = "#94A3B8";
const WALL_FILL = "#475569";
const ACCENT = "#62D0AD";
const ATTENTION = "#F7B23B";

const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease, fill-opacity 150ms ease" } as const;

const formatGuess = (value: number) => `guess from here: ${value}`;
const formatSteps = (value: number) => `steps taken: ${value}`;

const cellX = (col: number) => GRID_X + col * CELL;
const cellY = (row: number) => GRID_Y + row * CELL;
const centreX = (col: number) => cellX(col) + CELL / 2;
const centreY = (row: number) => cellY(row) + CELL / 2;

// ── Shared highlight ─────────────────────────────────────────────────────────

const useHighlightState = () => {
    const highlight = useVar<string>("guessWalkHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.7 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("guessWalkHighlight", id),
            onPointerLeave: () => setVar("guessWalkHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

// ── The drawing ──────────────────────────────────────────────────────────────

function GuessWalkDrawing({
    trail,
    onStepTo,
}: {
    trail: [number, number][];
    onStepTo: (col: number, row: number) => void;
}) {
    const { opacity, weight, isActive, hoverProps } = useHighlightState();
    const svgRef = useRef<SVGSVGElement>(null);

    const [col, row] = trail[trail.length - 1];
    const currentGuess = guessAt(col, row);
    const options = neighboursOf(col, row);
    const bestGuess = options.length ? Math.min(...options.map(([c, r]) => guessAt(c, r))) : currentGuess;
    const stuck = bestGuess >= currentGuess;
    const reached = col === NURSE[0] && row === NURSE[1];

    const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        const y = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
        const clickedCol = Math.floor((x - GRID_X) / CELL);
        const clickedRow = Math.floor((y - GRID_Y) / CELL);
        if (!inGrid(clickedCol, clickedRow) || isWall(clickedCol, clickedRow)) return;
        const isNeighbour = Math.abs(clickedCol - col) + Math.abs(clickedRow - row) === 1;
        if (!isNeighbour) return;
        onStepTo(clickedCol, clickedRow);
    };

    const openCells: [number, number][] = [];
    for (let r = 0; r < GRID_ROWS; r += 1) {
        for (let c = 0; c < GRID_COLS; c += 1) {
            if (!isWall(c, r)) openCells.push([c, r]);
        }
    }
    const trailKey = new Set(trail.map(([c, r]) => `${c},${r}`));
    const trailPath = trail.map(([c, r], index) => `${index === 0 ? "M" : "L"} ${centreX(c)} ${centreY(r)}`).join(" ");
    const labelStyle = {
        paintOrder: "stroke",
        stroke: "#FFFFFF",
        strokeWidth: 3,
        strokeLinejoin: "round",
    } as React.CSSProperties;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="Floor grid with a guess printed in every open square; click a neighbouring square to step the robot onto it"
            style={{ cursor: "pointer", touchAction: "manipulation" }}
            onClick={handleClick}
        >
            <defs>
                <filter id="guess-walk-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="32" fill={ACCENT} opacity={opacity("guesses")}>
                    {formatGuess(currentGuess)}
                </text>
                <text x={VIEW_WIDTH - 24} y="32" fill={INK} textAnchor="end" opacity={opacity("moves")}>
                    {formatSteps(trail.length - 1)}
                </text>
            </g>

            {/* The room itself. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                {Array.from({ length: GRID_ROWS }, (_, r) =>
                    Array.from({ length: GRID_COLS }, (_, c) => (
                        <rect
                            key={`floor-${c}-${r}`}
                            x={cellX(c)}
                            y={cellY(r)}
                            width={CELL}
                            height={CELL}
                            fill={isWall(c, r) ? WALL_FILL : "#FFFFFF"}
                            stroke={isWall(c, r) ? WALL_FILL : INK_QUIET}
                            strokeWidth="1"
                        />
                    )),
                )}
            </g>

            {/* THE GUESSES — one number per open square, walls ignored. */}
            <g
                {...hoverProps("guesses")}
                opacity={opacity("guesses")}
                fontSize="10"
                textAnchor="middle"
                style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}
            >
                {openCells.map(([c, r]) => (
                    <text
                        key={`guess-${c}-${r}`}
                        x={centreX(c)}
                        y={centreY(r) + 3}
                        fill={isActive("guesses") ? INK : GUESS_INK}
                        fontWeight={isActive("guesses") ? 600 : 400}
                    >
                        {guessAt(c, r)}
                    </text>
                ))}
            </g>

            {/* The walk so far — where the robot has already been. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                {trail.map(([c, r]) => (
                    <rect
                        key={`trail-${c}-${r}`}
                        x={cellX(c)}
                        y={cellY(r)}
                        width={CELL}
                        height={CELL}
                        fill={ACCENT}
                        fillOpacity={0.16}
                        stroke="none"
                    />
                ))}
                {trail.length > 1 && (
                    <path d={trailPath} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
            </g>

            {/* THE MOVES ON OFFER — the squares one step away, best guess ringed. */}
            <g {...hoverProps("moves")} opacity={opacity("moves")} style={EASE_150}>
                {options.map(([c, r]) => {
                    const best = guessAt(c, r) === bestGuess;
                    return (
                        <g key={`option-${c}-${r}`}>
                            <Halo active={isActive("moves") && best}>
                                <rect
                                    x={cellX(c)}
                                    y={cellY(r)}
                                    width={CELL}
                                    height={CELL}
                                    fill="none"
                                    stroke={ACCENT}
                                    strokeWidth={weight("moves", 2.5) + 6}
                                />
                            </Halo>
                            <rect
                                x={cellX(c)}
                                y={cellY(r)}
                                width={CELL}
                                height={CELL}
                                fill={ACCENT}
                                fillOpacity={best && !trailKey.has(`${c},${r}`) ? 0.22 : 0.06}
                                stroke={ACCENT}
                                strokeWidth={best ? weight("moves", 2.5) : 1.5}
                                strokeDasharray={best ? undefined : "3 3"}
                            />
                        </g>
                    );
                })}
            </g>

            {/* The two people, drawn last so nothing buries them. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <circle cx={centreX(col)} cy={centreY(row)} r="8" fill={INK} filter="url(#guess-walk-shadow)" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="8" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="3" fill={INK} />
                <g fill={INK} fontSize="11" textAnchor="middle" style={labelStyle}>
                    <text x={centreX(col)} y={centreY(row) - 14}>robot</text>
                    <text x={centreX(NURSE[0])} y={centreY(NURSE[1]) - 14}>nurse</text>
                </g>
            </g>

            <text
                x={VIEW_WIDTH / 2}
                y={VIEW_HEIGHT - 12}
                fontSize="12"
                textAnchor="middle"
                fill={reached ? INK : ATTENTION}
                opacity={stuck || reached ? 1 : 0}
                style={EASE_150}
            >
                {reached ? "The robot is standing with the nurse." : "No neighbour has a smaller guess."}
            </text>
        </svg>
    );
}

// ── Figure shell ─────────────────────────────────────────────────────────────

function GuessWalkFigure() {
    const setVar = useSetVar();
    const storedCol = useVar<number>("guessWalkCol", START[0]);
    const storedRow = useVar<number>("guessWalkRow", START[1]);
    const [trail, setTrail] = useState<[number, number][]>([START]);

    // If the position is set from outside (a reset, or a feedback hint), the
    // trail starts again from wherever it was put.
    useEffect(() => {
        const [col, row] = trail[trail.length - 1];
        if (storedCol !== col || storedRow !== row) {
            setTrail([[storedCol, storedRow]]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storedCol, storedRow]);

    const stepTo = (col: number, row: number) => {
        setTrail((previous) => {
            const withoutLast = previous.slice(0, -1);
            const stepsBack =
                withoutLast.length > 0 &&
                withoutLast[withoutLast.length - 1][0] === col &&
                withoutLast[withoutLast.length - 1][1] === row;
            const next: [number, number][] = stepsBack ? withoutLast : [...previous, [col, row]];
            setVar("guessWalkSteps", next.length - 1);
            return next;
        });
        setVar("guessWalkCol", col);
        setVar("guessWalkRow", row);
        setVar("guessWalkExplored", true);
    };

    return (
        <Figure
            id="heuristic-guess-walk"
            onReset={() => {
                setTrail([START]);
                setVar("guessWalkCol", START[0]);
                setVar("guessWalkRow", START[1]);
                setVar("guessWalkSteps", 0);
                setVar("guessWalkHighlight", "");
            }}
            caption="Every open square shows its guess. Click a neighbouring square to step onto it, and click the square behind you to take a step back."
        >
            <GuessWalkDrawing trail={trail} onStepTo={stepTo} />
            <InteractionHintSequence
                hintKey="heuristic-guess-walk-click"
                steps={[
                    {
                        gesture: "click",
                        label: "Click a neighbouring square to step onto it",
                        position: { x: "30%", y: "53%" },
                    },
                ]}
            />
        </Figure>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

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
                The robot does know one thing it was not using: where the nurse is. Even with walls in the way it
                can guess the distance left by counting squares as if the floor were empty, across and then up.
                From four columns and three rows away, that guess is 4 + 3 = 7.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-definition" maxWidth="xl">
        <Block id="heuristic-definition" padding="sm">
            <EditableParagraph id="para-heuristic-definition" blockId="heuristic-definition">
                That number is called a{" "}
                <InlineTooltip
                    id="tooltip-heuristic-definition"
                    tooltip="A cheap estimate of the distance still to travel, worked out without looking at the walls. It must never overshoot the true remaining distance."
                >
                    heuristic
                </InlineTooltip>
                : a cheap estimate that is never allowed to overshoot the true remaining distance. Walls can only
                make the real journey longer, never shorter, so counting across-and-up is always safe. Now walk
                the robot yourself: click a neighbouring square to step onto it, always taking the{" "}
                <InlineLinkedHighlight
                    varName="guessWalkHighlight"
                    highlightId="moves"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('guessWalkHighlight'))}
                >
                    smallest guess
                </InlineLinkedHighlight>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-walk" maxWidth="xl">
        <Block id="heuristic-visual" padding="sm" hasVisualization>
            <GuessWalkFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-both-halves" maxWidth="xl">
        <Block id="heuristic-both-halves" padding="sm">
            <EditableParagraph id="para-heuristic-both-halves" blockId="heuristic-both-halves">
                <InlineLinkedHighlight
                    varName="guessWalkHighlight"
                    highlightId="guesses"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('guessWalkHighlight'))}
                >
                    The guess
                </InlineLinkedHighlight>{" "}
                pulls hard towards the nurse, and then a wall it knows nothing about leaves every neighbour
                looking worse than where you stand. So the guess alone is not enough, and ignoring it wastes half
                the search. A* keeps both halves.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-question-value" maxWidth="xl">
        <Block id="heuristic-question-value" padding="md">
            <EditableParagraph id="para-heuristic-question-value" blockId="heuristic-question-value">
                A square three columns and five rows away from the nurse therefore carries a guess of{" "}
                <InlineFeedback
                    varName="answer_heuristic_value"
                    correctValue="8"
                    position="terminal"
                    successMessage="— three across plus five up, counted as though the room were completely empty"
                    failureMessage="— not quite"
                    hint="Add the two counts together, and remember the walls play no part in it"
                >
                    <InlineClozeInput
                        varName="answer_heuristic_value"
                        correctAnswer="8"
                        {...clozePropsFromDefinition(getVariableInfo('answer_heuristic_value'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-question-trap" maxWidth="xl">
        <Block id="heuristic-question-trap" padding="md">
            <EditableParagraph id="para-heuristic-question-trap" blockId="heuristic-question-trap">
                <RevealOnInteraction varName="guessWalkExplored">
                    Walking by the guess alone strands the robot because a small guess says nothing at all about{" "}
                    <InlineFeedback
                        varName="answer_heuristic_trap"
                        correctValue="the walls in the way"
                        position="terminal"
                        successMessage="— exactly, the guess is measured on an empty floor, so a pocket of walls comes as a complete surprise"
                        failureMessage="— not quite"
                        hint="Think about what the counting across-and-up deliberately ignores"
                        visualizationHint={{
                            blockId: "heuristic-visual",
                            hintKey: "feedback-heuristic-trap",
                            steps: [
                                {
                                    gesture: "click",
                                    label: "Step right along the row, always onto the ringed square, until nothing gets you closer",
                                    position: { x: "30%", y: "53%" },
                                    completionVar: "guessWalkCol",
                                    completionValue: 7,
                                    completionTolerance: 0.4,
                                },
                            ],
                            label: "Discover it yourself",
                            resetVars: { guessWalkCol: 2, guessWalkRow: 4, guessWalkSteps: 0 },
                        }}
                    >
                        <InlineClozeChoice
                            varName="answer_heuristic_trap"
                            correctAnswer="the walls in the way"
                            options={["the walls in the way", "the distance to the nurse", "the size of the room"]}
                            {...choicePropsFromDefinition(getVariableInfo('answer_heuristic_trap'))}
                        />
                    </InlineFeedback>.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
