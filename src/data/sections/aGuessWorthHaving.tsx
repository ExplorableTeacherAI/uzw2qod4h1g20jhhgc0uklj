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
    InlineSpotColor,
    InlineTooltip,
    InlineTrigger,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useSetVar, useVar, useVariableStore } from "@/stores";
import { useRafLoop } from "@/lib/motion";
import {
    ANSWER,
    ANSWER_BG,
    EASE_150,
    FORMULA_COLORS,
    GUESS,
    GUESS_TEXT,
    INK,
    INK_QUIET,
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
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    spotColorPropsFromDefinition,
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

/** Seconds between steps when the robot walks by itself. */
const AUTO_WALK_PERIOD = 0.45;

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
    const labelStyle = LABEL_OUTLINE as React.CSSProperties;

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
                <text x="24" y="32" fill={GUESS_TEXT} fontWeight={600} opacity={opacity("guesses")}>
                    {formatGuess(currentGuess)}
                </text>
                <text x={VIEW_WIDTH - 24} y="32" fill={WALKED_TEXT} textAnchor="end" opacity={opacity("trail")}>
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

            {/* THE GUESSES — one amber number per open square, walls ignored. */}
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
                        y={centreY(r) + 3.5}
                        fill={isActive("guesses") ? GUESS_TEXT : "#D9A441"}
                        fontWeight={isActive("guesses") ? 700 : 500}
                    >
                        {guessAt(c, r)}
                    </text>
                ))}
            </g>

            {/* THE WALK SO FAR — indigo, the colour of steps walked from the start. */}
            <g {...hoverProps("trail")} opacity={opacity("trail")} style={EASE_150}>
                {trail.map(([c, r]) => (
                    <rect
                        key={`trail-${c}-${r}`}
                        x={cellX(c)}
                        y={cellY(r)}
                        width={CELL}
                        height={CELL}
                        fill={WALKED}
                        fillOpacity={isActive("trail") ? 0.32 : 0.16}
                        stroke="none"
                    />
                ))}
                {trail.length > 1 && (
                    <>
                        <Halo active={isActive("trail")}>
                            <path d={trailPath} fill="none" stroke={WALKED} strokeWidth={weight("trail", 3) + 6} strokeLinecap="round" strokeLinejoin="round" />
                        </Halo>
                        <path d={trailPath} fill="none" stroke={WALKED} strokeWidth={weight("trail", 3)} strokeLinecap="round" strokeLinejoin="round" />
                    </>
                )}
            </g>

            {/* THE MOVES ON OFFER — the squares one step away, smallest guess ringed in amber. */}
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
                                    stroke={GUESS}
                                    strokeWidth={weight("moves", 2.5) + 6}
                                />
                            </Halo>
                            <rect
                                x={cellX(c)}
                                y={cellY(r)}
                                width={CELL}
                                height={CELL}
                                fill={GUESS}
                                fillOpacity={best && !trailKey.has(`${c},${r}`) ? 0.24 : 0.06}
                                stroke={GUESS}
                                strokeWidth={best ? weight("moves", 2.5) : 1.5}
                                strokeDasharray={best ? undefined : "3 3"}
                            />
                        </g>
                    );
                })}
            </g>

            {/* The two people, drawn last so nothing buries them. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <circle cx={centreX(col)} cy={centreY(row)} r="8" fill={ROBOT_FILL} stroke={ROBOT_EDGE} strokeWidth="2" filter="url(#guess-walk-shadow)" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="8" fill="#FFFFFF" stroke={NURSE_RING} strokeWidth="2.5" />
                <circle cx={centreX(NURSE[0])} cy={centreY(NURSE[1])} r="3" fill={NURSE_RING} />
                <g fontSize="11" fontWeight={600} textAnchor="middle" style={labelStyle}>
                    <text x={centreX(col)} y={centreY(row) - 14} fill={ROBOT_EDGE}>robot</text>
                    <text x={centreX(NURSE[0])} y={centreY(NURSE[1]) - 14} fill={NURSE_TEXT}>nurse</text>
                </g>
            </g>

            <text
                x={VIEW_WIDTH / 2}
                y={VIEW_HEIGHT - 12}
                fontSize="12"
                fontWeight={600}
                textAnchor="middle"
                fill={reached ? INK : GUESS_TEXT}
                opacity={stuck || reached ? 1 : 0}
                style={EASE_150}
            >
                {reached ? "The robot is standing with the nurse." : "Stuck: no neighbour has a smaller guess."}
            </text>
        </svg>
    );
}

// ── Figure shell ─────────────────────────────────────────────────────────────

function GuessWalkFigure() {
    const setVar = useSetVar();
    const storedCol = useVar<number>("guessWalkCol", START[0]);
    const storedRow = useVar<number>("guessWalkRow", START[1]);
    const playing = useVar<boolean>("guessWalkPlaying", false);
    const [trail, setTrail] = useState<[number, number][]>([START]);
    // The store re-renders synchronously, before React applies setTrail, so the
    // trail is mirrored in a ref and moves made here are flagged so the
    // "set from outside" effect below leaves them alone.
    const trailRef = useRef(trail);
    const ownMoveRef = useRef(false);
    const sinceLastStep = useRef(0);

    // If the position is set from outside (a reset, or a feedback hint), the
    // trail starts again from wherever it was put.
    useEffect(() => {
        if (ownMoveRef.current) {
            ownMoveRef.current = false;
            return;
        }
        const [col, row] = trailRef.current[trailRef.current.length - 1];
        if (storedCol !== col || storedRow !== row) {
            const fresh: [number, number][] = [[storedCol, storedRow]];
            trailRef.current = fresh;
            setTrail(fresh);
        }
    }, [storedCol, storedRow]);

    const stepTo = (col: number, row: number) => {
        const previous = trailRef.current;
        const withoutLast = previous.slice(0, -1);
        const stepsBack =
            withoutLast.length > 0 &&
            withoutLast[withoutLast.length - 1][0] === col &&
            withoutLast[withoutLast.length - 1][1] === row;
        const next: [number, number][] = stepsBack ? withoutLast : [...previous, [col, row]];
        trailRef.current = next;
        ownMoveRef.current = true;
        setTrail(next);
        setVar("guessWalkSteps", next.length - 1);
        setVar("guessWalkCol", col);
        setVar("guessWalkRow", row);
        setVar("guessWalkExplored", true);
    };

    // Play: the robot walks by itself, always onto the unvisited neighbour with
    // the smallest guess, and stops the moment no neighbour beats where it stands.
    useRafLoop(
        (dt) => {
            sinceLastStep.current += dt;
            if (sinceLastStep.current < AUTO_WALK_PERIOD) return;
            sinceLastStep.current = 0;
            const current = trailRef.current;
            const [col, row] = current[current.length - 1];
            const visited = new Set(current.map(([c, r]) => `${c},${r}`));
            const candidates = neighboursOf(col, row).filter(([c, r]) => !visited.has(`${c},${r}`));
            const best = candidates.reduce<[number, number] | null>(
                (bestSoFar, next) => (!bestSoFar || guessAt(next[0], next[1]) < guessAt(bestSoFar[0], bestSoFar[1]) ? next : bestSoFar),
                null,
            );
            const reached = col === NURSE[0] && row === NURSE[1];
            if (reached || !best || guessAt(best[0], best[1]) >= guessAt(col, row)) {
                setVar("guessWalkPlaying", false);
                return;
            }
            stepTo(best[0], best[1]);
        },
        { paused: !playing },
    );

    return (
        <Figure
            id="heuristic-guess-walk"
            playable
            playVarName="guessWalkPlaying"
            onReset={() => {
                trailRef.current = [START];
                setTrail([START]);
                sinceLastStep.current = 0;
                setVar("guessWalkPlaying", false);
                setVar("guessWalkCol", START[0]);
                setVar("guessWalkRow", START[1]);
                setVar("guessWalkSteps", 0);
                setVar("guessWalkHighlight", "");
            }}
            caption="Every open square shows its amber guess. Click a neighbouring square to step onto it (click the square behind you to step back), or press play and the robot walks by itself, always onto the smallest guess."
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

/** The guess for wherever the robot stands right now, worked in the open. */
function GuessWalkLiveGuess() {
    const col = useVar<number>("guessWalkCol", START[0]);
    const row = useVar<number>("guessWalkRow", START[1]);
    const across = Math.abs(col - NURSE[0]);
    const up = Math.abs(row - NURSE[1]);
    return (
        <>
            <InlineSpotColor varName="astarNextH" {...spotColorPropsFromDefinition(getVariableInfo('astarNextH'))}>
                {`${across} ${across === 1 ? "column" : "columns"}`}
            </InlineSpotColor>{" "}
            and{" "}
            <InlineSpotColor varName="astarNextH" {...spotColorPropsFromDefinition(getVariableInfo('astarNextH'))}>
                {`${up} ${up === 1 ? "row" : "rows"}`}
            </InlineSpotColor>{" "}
            from the <NurseWord />, so its guess is{" "}
            <InlineFormula latex={`\\clr{h}{h} = ${across} + ${up} = \\clr{h}{${across + up}}`} colorMap={FORMULA_COLORS} />
        </>
    );
}

/** Steps walked so far, in the walked-distance colour. */
function GuessWalkLiveSteps() {
    const steps = useVar<number>("guessWalkSteps", 0);
    return (
        <InlineSpotColor varName="guessWalkSteps" {...spotColorPropsFromDefinition(getVariableInfo('guessWalkSteps'))}>
            {`${steps} ${steps === 1 ? "step" : "steps"}`}
        </InlineSpotColor>
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
                The <RobotWord /> does know one thing it was not using: where the <NurseWord /> is. Even with walls in the way it
                can guess the distance left by counting squares as if the floor were empty, across and then up.
                From four columns and three rows away, that guess is{" "}
                <InlineFormula latex="\clr{h}{h} = 4 + 3 = \clr{h}{7}" colorMap={FORMULA_COLORS} />.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-definition" maxWidth="xl">
        <Block id="heuristic-definition" padding="sm">
            <EditableParagraph id="para-heuristic-definition" blockId="heuristic-definition">
                That number is called a{" "}
                <InlineTooltip
                    id="tooltip-heuristic-definition"
                    color={ANSWER}
                    bgColor={ANSWER_BG}
                    tooltip="A cheap estimate of the distance still to travel, worked out without looking at the walls. It must never overshoot the true remaining distance."
                >
                    heuristic
                </InlineTooltip>
                : a cheap estimate that is never allowed to overshoot the true remaining distance. Walls can only
                make the real journey longer, never shorter, so counting across-and-up is always safe. Now walk
                the <RobotWord /> yourself: click a neighbouring square to step onto it, always taking the{" "}
                <InlineLinkedHighlight
                    varName="guessWalkHighlight"
                    highlightId="moves"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('guessWalkHighlight'))}
                >
                    smallest guess
                </InlineLinkedHighlight>
                , and watch your{" "}
                <InlineLinkedHighlight
                    varName="guessWalkHighlight"
                    highlightId="trail"
                    color={WALKED}
                    bgColor="rgba(142, 144, 245, 0.22)"
                >
                    trail
                </InlineLinkedHighlight>{" "}
                grow behind you.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-walk" maxWidth="xl">
        <Block id="heuristic-visual" padding="sm" hasVisualization>
            <GuessWalkFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-live" maxWidth="xl">
        <Block id="heuristic-live" padding="sm">
            <EditableParagraph id="para-heuristic-live" blockId="heuristic-live">
                The <RobotWord /> now stands <GuessWalkLiveGuess />, having walked <GuessWalkLiveSteps /> to get there. When
                you have seen it stuck, you can{" "}
                <InlineTrigger
                    varName="guessWalkCol"
                    value={START[0]}
                    icon="refresh"
                    onTrigger={() =>
                        useVariableStore.getState().setVariables({
                            guessWalkRow: START[1],
                            guessWalkSteps: 0,
                            guessWalkPlaying: false,
                        })
                    }
                >
                    put it back at the start
                </InlineTrigger>{" "}
                and try a different route.
            </EditableParagraph>
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
                pulls hard towards the <NurseWord />, and then a wall it knows nothing about leaves every neighbour
                looking worse than where you stand. So the guess alone is not enough, and ignoring it wastes half
                the search. A* keeps both halves: the{" "}
                <InlineSpotColor varName="guessWalkSteps" {...spotColorPropsFromDefinition(getVariableInfo('guessWalkSteps'))}>
                    steps walked
                </InlineSpotColor>{" "}
                from the previous section and the{" "}
                <InlineSpotColor varName="astarNextH" {...spotColorPropsFromDefinition(getVariableInfo('astarNextH'))}>
                    guess
                </InlineSpotColor>{" "}
                from this one.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-heuristic-question-value" maxWidth="xl">
        <Block id="heuristic-question-value" padding="md">
            <EditableParagraph id="para-heuristic-question-value" blockId="heuristic-question-value">
                A square three columns and five rows away from the <NurseWord /> therefore carries a guess of{" "}
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
                    Walking by the guess alone strands the <RobotWord /> because a small guess says nothing at all about{" "}
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
