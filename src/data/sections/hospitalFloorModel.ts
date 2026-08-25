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

/** A*: always take the smallest f = g + h next, settling ties on the smaller guess. */
const runAStar = () => {
    const key = (col: number, row: number) => `${col},${row}`;
    const cost = new Map<string, number>([[key(...ROBOT), 0]]);
    const cameFrom = new Map<string, [number, number]>();
    const open = new Map<string, [number, number]>([[key(...ROBOT), ROBOT]]);
    const expanded: [number, number][] = [];

    while (open.size > 0) {
        let best: [number, number] | null = null;
        let bestRank: number[] | null = null;
        for (const [cellKey, cell] of open) {
            const g = cost.get(cellKey) ?? Number.POSITIVE_INFINITY;
            const h = guessAt(cell[0], cell[1]);
            const rank = [g + h, h, cell[1], cell[0]];
            if (!bestRank || rankLess(rank, bestRank)) {
                best = cell;
                bestRank = rank;
            }
        }
        if (!best || !bestRank) break;
        open.delete(key(best[0], best[1]));
        expanded.push(best);
        if (best[0] === NURSE[0] && best[1] === NURSE[1]) break;
        const nextCost = (cost.get(key(best[0], best[1])) ?? 0) + 1;
        for (const [dx, dy] of STEPS) {
            const nextCol = best[0] + dx;
            const nextRow = best[1] + dy;
            if (!inGrid(nextCol, nextRow) || isWall(nextCol, nextRow)) continue;
            const nextKey = key(nextCol, nextRow);
            if (nextCost < (cost.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
                cost.set(nextKey, nextCost);
                cameFrom.set(nextKey, best);
                open.set(nextKey, [nextCol, nextRow]);
            }
        }
    }
    return { expanded, path: tracePath(cameFrom) };
};

const aStar = runAStar();

export const ASTAR_EXPANDED = aStar.expanded;
export const ASTAR_CHECKED = aStar.expanded.length;
export const ASTAR_ROUTE = aStar.path;
