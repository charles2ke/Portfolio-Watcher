import type { Holding } from '../risk'
import type { AssetClass } from '../builder'

/** Maps a portfolio holding onto the asset class used by the portfolio builder. */
export function assetClassFor(holding: Holding): AssetClass {
  if (holding.ticker === 'CASH') return 'cash'
  if (holding.sector === 'Real Estate') return 'reits'
  if (holding.sector === 'Energy' || holding.sector === 'Materials') return 'commodities'
  return holding.country === 'United States' ? 'domestic-equity' : 'international-equity'
}
