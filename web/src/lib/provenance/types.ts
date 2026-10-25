// Shapes of the generated chart files (data/charts/*.json, produced by solver-cli gen-charts).

export type Source = 'solver_exact' | 'solver_approx' | 'authored';

export type Provenance = {
  schema: string;
  source: Source;
  generator: string;
  solverCoreVersion: string;
  solver: Record<string, unknown> | null;
  model: Record<string, unknown> | null;
  generatedAt: string;
  gitCommit: string;
  gitDirty: boolean | null;
  notes: string;
};

export type Chart = {
  id: string;
  title: string;
  seat: string;
  stack?: number;
  scenario?: string;
  line?: string;
  actions: string[];
  /** Per class (169, grid order): probability of each action. */
  strategy: number[][];
  /** Per class: EV of each action in bb (null where not available). */
  ev?: (number | null)[][];
  evStdError?: (number | null)[][];
  /** Per class: probability the player gets here with the hand by their own earlier choices. */
  reach?: number[];
  solve?: { iterations: number; exploitabilityBb: number };
};

export type SanityBand = { seat: string; low: number; high: number; measured: number; inBand: boolean };

export type ChartFile = {
  provenance: Provenance;
  family: string;
  players?: number;
  stack?: number;
  classes: string[];
  evUnit: string;
  charts: Chart[];
  sanityBands?: SanityBand[];
  bestResponseGainBb?: number[];
  solves?: { stack: number; bestResponseGainBb: number[] }[];
};

export type ChartIndexEntry = {
  file: string;
  family: string;
  players: number;
  stacks: number[];
  source: Source;
  generatedAt: string;
  gitCommit: string;
  gitDirty: boolean | null;
  charts: number;
  outOfBand: boolean;
};

export async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!res.ok) throw new Error(`couldn't load ${path} (${res.status})`);
  return (await res.json()) as T;
}
