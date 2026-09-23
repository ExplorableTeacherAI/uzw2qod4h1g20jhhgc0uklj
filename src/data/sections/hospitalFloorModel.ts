/**
 * The hospital floor the lesson keeps coming back to: one room, one robot, one
 * nurse. Both the blind search and A* are computed from this single model, so
 * the two sections can never drift apart.
 */

export const GRID_COLS = 13;
export const GRID_ROWS = 9;
export const ROBOT: [number, number] = [2, 4];
export const NURSE: [number, number] = [11, 4];

export const WALLS: ReadonlySet<string> = new Set<string>([
    ...Array.from({ length: 6 }, (_, row) => `6,${row}`),
    ...Array.from({ length: 6 }, (_, index) => `9,${index + 3}`),
]);

export const isWall = (col: number, row: number) => WALLS.has(`${col},${row}`);
export const inGrid = (col: number, row: number) =>
    col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** The guess: steps to the nurse across an empty floor. */
export const guessAt = (col: number, row: number) =>
    Math.abs(col - NURSE[0]) + Math.abs(row - NURSE[1]);

const runBreadthFirst = () => {
    const distances = Array.from({ length: GRID_ROWS }, () =>
        Array.from({ length: GRID_COLS }, () => Number.POSITIVE_INFINITY),
    );
    const cameFrom = new Map<string, [number, number]>();
    distances[ROBOT[1]][ROBOT[0]] = 0;
    const queue: [number, number][] = [ROBOT];
    let head = 0;
    while (head < queue.length) {
        const [col, row] = queue[head++];
        const next = distances[row][col] + 1;
        for (const [dx, dy] of STEPS) {
            const nextCol = col + dx;
            const nextRow = row + dy;
            if (!inGrid(nextCol, nextRow) || isWall(nextCol, nextRow)) continue;
            if (distances[nextRow][nextCol] <= next) continue;
            distances[nextRow][nextCol] = next;
            cameFrom.set(`${nextCol},${nextRow}`, [col, row]);
            queue.push([nextCol, nextRow]);
        }
    }
    return { distances, cameFrom };
};

const breadthFirst = runBreadthFirst();

/** Steps from the robot to every reachable square (Infinity through walls). */
export const DISTANCES = breadthFirst.distances;
export const ROUTE_LENGTH = DISTANCES[NURSE[1]][NURSE[0]];

const tracePath = (cameFrom: Map<string, [number, number]>): [number, number][] => {
    const path: [number, number][] = [NURSE];
    while (path[path.length - 1][0] !== ROBOT[0] || path[path.length - 1][1] !== ROBOT[1]) {
        const [col, row] = path[path.length - 1];
        const previous = cameFrom.get(`${col},${row}`);
        if (!previous) break;
        path.push(previous);
    }
    return path.reverse();
};

export const BLIND_ROUTE = tracePath(breadthFirst.cameFrom);

/** Steps from the nurse to every square — a square lies on some shortest path iff its two distances add to ROUTE_LENGTH. */
const distancesFromNurse = (() => {
    const distances = Array.from({ length: GRID_ROWS }, () =>
        Array.from({ length: GRID_COLS }, () => Number.POSITIVE_INFINITY),
    );
    distances[NURSE[1]][NURSE[0]] = 0;
    const queue: [number, number][] = [NURSE];
    let head = 0;
    while (head < queue.length) {
        const [col, row] = queue[head++];
        const next = distances[row][col] + 1;
        for (const [dx, dy] of STEPS) {
            const nextCol = col + dx;
            const nextRow = row + dy;
            if (!inGrid(nextCol, nextRow) || isWall(nextCol, nextRow)) continue;
            if (distances[nextRow][nextCol] <= next) continue;
            distances[nextRow][nextCol] = next;
            queue.push([nextCol, nextRow]);
        }
    }
    return distances;
})();

/** Every shortest path from the robot to the nurse (there are only a few dozen on this floor). */
const enumerateShortestPaths = (limit: number): [number, number][][] => {
    const paths: [number, number][][] = [];
    const walk = (path: [number, number][]) => {
        if (paths.length >= limit) return;
        const [col, row] = path[path.length - 1];
        if (col === NURSE[0] && row === NURSE[1]) {
            paths.push(path);
            return;
        }
        for (const [dx, dy] of STEPS) {
            const nextCol = col + dx;
            const nextRow = row + dy;
            if (!inGrid(nextCol, nextRow) || isWall(nextCol, nextRow)) continue;
            if (DISTANCES[nextRow][nextCol] !== path.length) continue;
            if (distancesFromNurse[nextRow][nextCol] !== ROUTE_LENGTH - path.length) continue;
            walk([...path, [nextCol, nextRow]]);
        }
    };
    walk([ROBOT]);
    return paths;
};

export const ALL_SHORTEST_PATHS = enumerateShortestPaths(2000);

/** A few shortest paths chosen to look as different from one another as possible. */
export const SHORTEST_PATH_SAMPLE: [number, number][][] = (() => {
    const key = ([col, row]: [number, number]) => `${col},${row}`;
    const chosen: [number, number][][] = [];
    const covered = new Set<string>();
    while (chosen.length < 4 && chosen.length < ALL_SHORTEST_PATHS.length) {
        let best: [number, number][] | null = null;
        let bestNew = -1;
        for (const path of ALL_SHORTEST_PATHS) {
            if (chosen.includes(path)) continue;
            const fresh = path.filter((cell) => !covered.has(key(cell))).length;
            if (fresh > bestNew) {
                best = path;
                bestNew = fresh;
            }
        }
        if (!best) break;
        chosen.push(best);
        best.forEach((cell) => covered.add(key(cell)));
    }
    return chosen;
})();

/** Squares the blind search has been through once it is `step` steps out. */
export const CHECKED_COUNTS: number[] = Array.from({ length: ROUTE_LENGTH + 1 }, (_, step) =>
    DISTANCES.flat().filter((distance) => distance <= step).length,
);
export const BLIND_CHECKED = CHECKED_COUNTS[ROUTE_LENGTH];


/** Lexicographic "is a before b" over the ranking tuple. */
const rankLess = (a: number[], b: number[]) => {
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) return a[index] < b[index];
    }
    return false;
};

/** One square on offer to A*, with the two halves of its score. */
export interface ScoredCell {
    cell: [number, number];
    g: number;
    h: number;
    f: number;
}

/** What A* could see at the moment it made one choice. */
export interface AStarSnapshot {
    /** The square it picks: smallest f, ties settled on the smaller guess. */
    pick: ScoredCell;
    /** Every square on offer at that moment, the pick included. */
    open: ScoredCell[];
}

/** A*: always take the smallest f = g + h next, settling ties on the smaller guess. */
const runAStar = () => {
    const key = (col: number, row: number) => `${col},${row}`;
    const cost = new Map<string, number>([[key(...ROBOT), 0]]);
    const cameFrom = new Map<string, [number, number]>();
    const open = new Map<string, [number, number]>([[key(...ROBOT), ROBOT]]);
    const expanded: [number, number][] = [];
    const trace: AStarSnapshot[] = [];

    while (open.size > 0) {
        let best: ScoredCell | null = null;
        let bestRank: number[] | null = null;
        const offered: ScoredCell[] = [];
        for (const [cellKey, cell] of open) {
            const g = cost.get(cellKey) ?? Number.POSITIVE_INFINITY;
            const h = guessAt(cell[0], cell[1]);
            const scored: ScoredCell = { cell, g, h, f: g + h };
            offered.push(scored);
            const rank = [g + h, h, cell[1], cell[0]];
            if (!bestRank || rankLess(rank, bestRank)) {
                best = scored;
                bestRank = rank;
            }
        }
        if (!best) break;
        trace.push({ pick: best, open: offered });
        const [col, row] = best.cell;
        open.delete(key(col, row));
        expanded.push(best.cell);
        if (col === NURSE[0] && row === NURSE[1]) break;
        const nextCost = best.g + 1;
        for (const [dx, dy] of STEPS) {
            const nextCol = col + dx;
            const nextRow = row + dy;
            if (!inGrid(nextCol, nextRow) || isWall(nextCol, nextRow)) continue;
            const nextKey = key(nextCol, nextRow);
            if (nextCost < (cost.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
                cost.set(nextKey, nextCost);
                cameFrom.set(nextKey, best.cell);
                open.set(nextKey, [nextCol, nextRow]);
            }
        }
    }
    return { expanded, trace, path: tracePath(cameFrom) };
};

const aStar = runAStar();

export const ASTAR_EXPANDED = aStar.expanded;
export const ASTAR_CHECKED = aStar.expanded.length;
export const ASTAR_ROUTE = aStar.path;
/** One snapshot per square A* checked, in the order it checked them. */
export const ASTAR_TRACE = aStar.trace;
