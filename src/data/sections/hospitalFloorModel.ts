/**
 * The hospital floor the lesson keeps coming back to: one room, one robot, one
 * nurse. Both the blind search and A* are computed from this single model by
 * the shared search engine, so the sections can never drift apart.
 */

import {
    type Cell,
    type Floor,
    cellKey,
    distancesFrom,
    guessTo,
    solve,
} from "./searchEngine";

export type { ScoredCell, SearchSnapshot as AStarSnapshot } from "./searchEngine";

export const GRID_COLS = 13;
export const GRID_ROWS = 9;
export const ROBOT: Cell = [2, 4];
export const NURSE: Cell = [11, 4];

export const WALLS: ReadonlySet<string> = new Set<string>([
    ...Array.from({ length: 6 }, (_, row) => cellKey(6, row)),
    ...Array.from({ length: 6 }, (_, index) => cellKey(9, index + 3)),
]);

export const HOSPITAL_FLOOR: Floor = { cols: GRID_COLS, rows: GRID_ROWS, walls: WALLS, robot: ROBOT, nurse: NURSE };

export const isWall = (col: number, row: number) => WALLS.has(cellKey(col, row));
export const inGrid = (col: number, row: number) =>
    col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;

/** The guess: steps to the nurse across an empty floor. */
export const guessAt = (col: number, row: number) => guessTo(NURSE, col, row);

/** Steps from the robot to every reachable square (Infinity through walls). */
export const DISTANCES = distancesFrom(HOSPITAL_FLOOR, ROBOT);
export const ROUTE_LENGTH = DISTANCES[NURSE[1]][NURSE[0]];

const blind = solve(HOSPITAL_FLOOR, "blind");
export const BLIND_ROUTE = blind.route;

/** Squares the blind search has been through once it is `step` steps out. */
export const CHECKED_COUNTS: number[] = Array.from({ length: ROUTE_LENGTH + 1 }, (_, step) =>
    DISTANCES.flat().filter((distance) => distance <= step).length,
);
export const BLIND_CHECKED = CHECKED_COUNTS[ROUTE_LENGTH];

/** Steps from the nurse to every square — a square lies on some shortest path iff its two distances add to ROUTE_LENGTH. */
const distancesFromNurse = distancesFrom(HOSPITAL_FLOOR, NURSE);

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Every shortest path from the robot to the nurse (there are only a few dozen on this floor). */
const enumerateShortestPaths = (limit: number): Cell[][] => {
    const paths: Cell[][] = [];
    const walk = (path: Cell[]) => {
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
export const SHORTEST_PATH_SAMPLE: Cell[][] = (() => {
    const chosen: Cell[][] = [];
    const covered = new Set<string>();
    while (chosen.length < 4 && chosen.length < ALL_SHORTEST_PATHS.length) {
        let best: Cell[] | null = null;
        let bestNew = -1;
        for (const path of ALL_SHORTEST_PATHS) {
            if (chosen.includes(path)) continue;
            const fresh = path.filter(([col, row]) => !covered.has(cellKey(col, row))).length;
            if (fresh > bestNew) {
                best = path;
                bestNew = fresh;
            }
        }
        if (!best) break;
        chosen.push(best);
        best.forEach(([col, row]) => covered.add(cellKey(col, row)));
    }
    return chosen;
})();

const aStar = solve(HOSPITAL_FLOOR, "astar");

export const ASTAR_EXPANDED = aStar.expanded;
export const ASTAR_CHECKED = aStar.expanded.length;
export const ASTAR_ROUTE = aStar.route;
/** One snapshot per square A* checked, in the order it checked them. */
export const ASTAR_TRACE = aStar.trace;
