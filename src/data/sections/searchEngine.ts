/**
 * The two searches the lesson compares, written once over any floor: the
 * fixed hospital floor in the sections, and whatever the student draws in the
 * playground. Both are "take the cheapest square next"; they differ only in
 * what cheapest means.
 */

export type Cell = [number, number];

export interface Floor {
    cols: number;
    rows: number;
    /** Wall squares as "col,row" keys. */
    walls: ReadonlySet<string>;
    robot: Cell;
    nurse: Cell;
}

export type SearchMode = "astar" | "blind";

/** One square on offer to the search, with the two halves of its score. */
export interface ScoredCell {
    cell: Cell;
    g: number;
    h: number;
    f: number;
}

/** What the search could see at the moment it made one choice. */
export interface SearchSnapshot {
    /** The square it picks. */
    pick: ScoredCell;
    /** Every square on offer at that moment, the pick included. */
    open: ScoredCell[];
}

export interface SearchResult {
    /** One snapshot per square checked, in the order they were checked. */
    trace: SearchSnapshot[];
    /** The squares checked, in order. */
    expanded: Cell[];
    /** The route handed back, robot first; empty when the nurse cannot be reached. */
    route: Cell[];
    reached: boolean;
}

export const cellKey = (col: number, row: number) => `${col},${row}`;

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export const isOpen = (floor: Floor, col: number, row: number) =>
    col >= 0 && col < floor.cols && row >= 0 && row < floor.rows && !floor.walls.has(cellKey(col, row));

/** The guess: steps to the nurse across an empty floor, walls ignored. */
export const guessTo = (nurse: Cell, col: number, row: number) =>
    Math.abs(col - nurse[0]) + Math.abs(row - nurse[1]);

/** Steps from `origin` to every square (Infinity through walls). */
export const distancesFrom = (floor: Floor, origin: Cell): number[][] => {
    const distances = Array.from({ length: floor.rows }, () =>
        Array.from({ length: floor.cols }, () => Number.POSITIVE_INFINITY),
    );
    distances[origin[1]][origin[0]] = 0;
    const queue: Cell[] = [origin];
    let head = 0;
    while (head < queue.length) {
        const [col, row] = queue[head++];
        const next = distances[row][col] + 1;
        for (const [dx, dy] of STEPS) {
            const nextCol = col + dx;
            const nextRow = row + dy;
            if (!isOpen(floor, nextCol, nextRow) || distances[nextRow][nextCol] <= next) continue;
            distances[nextRow][nextCol] = next;
            queue.push([nextCol, nextRow]);
        }
    }
    return distances;
};

/** Lexicographic "is a before b" over the ranking tuple. */
const rankLess = (a: number[], b: number[]) => {
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) return a[index] < b[index];
    }
    return false;
};

const traceRoute = (floor: Floor, cameFrom: Map<string, Cell>): Cell[] => {
    const path: Cell[] = [floor.nurse];
    while (path[path.length - 1][0] !== floor.robot[0] || path[path.length - 1][1] !== floor.robot[1]) {
        const [col, row] = path[path.length - 1];
        const previous = cameFrom.get(cellKey(col, row));
        if (!previous) return [];
        path.push(previous);
    }
    return path.reverse();
};

/**
 * Run a search over the floor.
 *
 * A*: always take the smallest f = g + h next, ties settled on the smaller
 * guess. Blind: take the smallest g next and finish each ring before moving
 * on — the nurse is the last square of her own ring, so the count matches the
 * ring-by-ring picture in the Searching Blind section.
 */
export const solve = (floor: Floor, mode: SearchMode): SearchResult => {
    const { robot, nurse } = floor;
    const cost = new Map<string, number>([[cellKey(...robot), 0]]);
    const cameFrom = new Map<string, Cell>();
    const open = new Map<string, Cell>([[cellKey(...robot), robot]]);
    const expanded: Cell[] = [];
    const trace: SearchSnapshot[] = [];
    let reached = false;

    while (open.size > 0) {
        let best: ScoredCell | null = null;
        let bestRank: number[] | null = null;
        const offered: ScoredCell[] = [];
        for (const [key, cell] of open) {
            const g = cost.get(key) ?? Number.POSITIVE_INFINITY;
            const h = mode === "astar" ? guessTo(nurse, cell[0], cell[1]) : 0;
            const scored: ScoredCell = { cell, g, h, f: g + h };
            offered.push(scored);
            const isNurse = cell[0] === nurse[0] && cell[1] === nurse[1] ? 1 : 0;
            const rank =
                mode === "astar"
                    ? [g + h, h, cell[1], cell[0]]
                    : [g, isNurse, cell[1], cell[0]];
            if (!bestRank || rankLess(rank, bestRank)) {
                best = scored;
                bestRank = rank;
            }
        }
        if (!best) break;
        trace.push({ pick: best, open: offered });
        const [col, row] = best.cell;
        open.delete(cellKey(col, row));
        expanded.push(best.cell);
        if (col === nurse[0] && row === nurse[1]) {
            reached = true;
            break;
        }
        const nextCost = best.g + 1;
        for (const [dx, dy] of STEPS) {
            const nextCol = col + dx;
            const nextRow = row + dy;
            if (!isOpen(floor, nextCol, nextRow)) continue;
            const nextKey = cellKey(nextCol, nextRow);
            if (nextCost < (cost.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
                cost.set(nextKey, nextCost);
                cameFrom.set(nextKey, best.cell);
                open.set(nextKey, [nextCol, nextRow]);
            }
        }
    }
    return { trace, expanded, route: reached ? traceRoute(floor, cameFrom) : [], reached };
};
