import { t, type MessageKey } from '../../../lib/i18n';
import { IcmWidget, ToyGame, VarianceWidget } from './games';
import { BoardExplorer, ComboCounter, HandRanker, OutsCalculator } from './hands';
import { EvCalculator, PotOdds, SizingExplorer, SprCalculator } from './math';
import { ChartEmbed, EquityWidget, RangeAdvantage, RangeGrid } from './ranges';
import { MiniSolver } from './solver';
import { HandFlow, TableDiagram } from './table';

type Config = Record<string, unknown>;

const COMPONENTS: Record<string, (p: { config: Config }) => React.JSX.Element> = {
  ranker: HandRanker,
  board: BoardExplorer,
  outs: OutsCalculator,
  combos: ComboCounter,
  potodds: PotOdds,
  ev: EvCalculator,
  spr: SprCalculator,
  sizing: SizingExplorer,
  grid: RangeGrid,
  chart: ChartEmbed,
  advantage: RangeAdvantage,
  equity: EquityWidget,
  table: TableDiagram,
  handflow: HandFlow,
  minisolver: MiniSolver,
  toygame: ToyGame,
  icm: IcmWidget,
  variance: VarianceWidget,
};

/** A lesson widget in a labelled frame. */
export function Widget({ name, config }: { name: string; config: Config }) {
  const C = COMPONENTS[name];
  return (
    <figure className="card space-y-3 border-sky-200 dark:border-sky-900" data-testid={`widget-${name}`}>
      <figcaption className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">{t(`widget.${name}` as MessageKey)}</figcaption>
      {C ? <C config={config} /> : <p>{t('widget.unknown', { name })}</p>}
    </figure>
  );
}
