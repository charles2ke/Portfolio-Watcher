import { createRandom, hashString, normalFrom } from './random'
import type {
  CompanyRecord,
  EarningsQuarter,
  Fundamentals,
  MoatDimension,
  PricePoint,
  Provenance,
  Security,
} from './types'

/**
 * Bundled sample universe.
 *
 * The application ships without a market-data contract, so the universe is an
 * explicitly fictional dataset. Companies, prices and financials are generated
 * deterministically and labelled as sample data through their provenance
 * record — nothing here is presented as a real company's reported figures.
 * Swapping in a licensed provider only requires replacing `loadUniverse`.
 */

export const DATA_PROVIDER = 'Portfolio Watcher sample dataset'
export const DATA_SOURCE = 'bundled-sample-v1'
export const AS_OF = '2026-09-18'
export const RETRIEVED_AT = '2026-09-18T21:05:00.000Z'
export const TRADING_DAYS = 504

export const MOAT_DIMENSIONS = [
  'Brand',
  'Cost position',
  'Switching costs',
  'Network effects',
  'Scale',
  'Distribution',
  'Intellectual property',
  'Regulation',
  'Ecosystem',
] as const

interface Narrative {
  innovation: string[]
  capitalAllocation: string[]
  threats: string[]
  catalysts: string[]
  risks: string[]
}

const EMPTY_NARRATIVE: Narrative = {
  innovation: [],
  capitalAllocation: [],
  threats: [],
  catalysts: [],
  risks: [],
}

interface Seed {
  ticker: string
  name: string
  exchange: string
  currency: string
  sector: string
  industry: string
  country: string
  price: number
  drift: number
  vol: number
  /** Revenue in millions of the reporting currency. */
  revenue: number
  revenueGrowth: number
  grossMargin: number
  operatingMargin: number
  netMargin: number
  eps: number
  epsGrowth: number
  /** Diluted shares in millions. */
  shares: number
  /** Net debt in millions (negative means net cash). */
  netDebt: number
  /** Free cash flow in millions. */
  fcf: number
  roic: number
  roe: number
  debtToEquity: number
  beta: number
  taxRate: number
  rnd: number
  /** Annual dividend per share, `0` when the company pays no dividend. */
  dividend: number
  dividendGrowthYears: number
  lastCutYear: number | null
  kpis: [string, number, string][]
  guidance: [string, number, number, number | null, string][]
  peers: string[]
  marketShare: number[] | null
  moatScores: number[]
  narrative: Narrative
  hasOptions: boolean
}

const SEEDS: Seed[] = [
  {
    ticker: 'ARCL',
    name: 'Arclight Semiconductor',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Information Technology',
    industry: 'Semiconductors',
    country: 'United States',
    price: 184,
    drift: 0.24,
    vol: 0.38,
    revenue: 28400,
    revenueGrowth: 0.31,
    grossMargin: 0.58,
    operatingMargin: 0.33,
    netMargin: 0.27,
    eps: 6.2,
    epsGrowth: 0.28,
    shares: 1240,
    netDebt: -8200,
    fcf: 7100,
    roic: 0.29,
    roe: 0.34,
    debtToEquity: 0.32,
    beta: 1.35,
    taxRate: 0.16,
    rnd: 5200,
    dividend: 0.92,
    dividendGrowthYears: 6,
    lastCutYear: null,
    kpis: [
      ['Data-centre revenue', 12400, 'USD m'],
      ['Inventory days', 96, 'days'],
      ['Gross margin', 58, '%'],
    ],
    guidance: [
      ['Revenue', 7400, 7700, 7520, 'USD m'],
      ['Gross margin', 57, 59, 58.2, '%'],
    ],
    peers: ['KNSU', 'NBLA', 'CNVX'],
    marketShare: [14.2, 15.6, 17.1],
    moatScores: [4, 3, 4, 3, 4, 3, 5, 2, 3],
    narrative: {
      innovation: [
        'Sample dataset records three process-node transitions funded from operating cash flow.',
      ],
      capitalAllocation: [
        'Sample dataset shows buybacks equal to 42% of free cash flow and a rising dividend.',
      ],
      threats: ['Customer concentration in hyperscale data-centre buyers.'],
      catalysts: ['Next-generation accelerator launch scheduled in the sample calendar.'],
      risks: ['Cyclical inventory corrections compress margins quickly.'],
    },
    hasOptions: true,
  },
  {
    ticker: 'NBLA',
    name: 'Nebula Cloud Systems',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Information Technology',
    industry: 'Application Software',
    country: 'United States',
    price: 268,
    drift: 0.18,
    vol: 0.32,
    revenue: 9600,
    revenueGrowth: 0.24,
    grossMargin: 0.79,
    operatingMargin: 0.21,
    netMargin: 0.17,
    eps: 4.05,
    epsGrowth: 0.22,
    shares: 402,
    netDebt: -2400,
    fcf: 2150,
    roic: 0.19,
    roe: 0.24,
    debtToEquity: 0.28,
    beta: 1.18,
    taxRate: 0.19,
    rnd: 2100,
    dividend: 0,
    dividendGrowthYears: 0,
    lastCutYear: null,
    kpis: [
      ['Net revenue retention', 118, '%'],
      ['Remaining performance obligations', 14200, 'USD m'],
      ['Annual recurring revenue growth', 23, '%'],
    ],
    guidance: [
      ['Revenue', 2550, 2610, 2575, 'USD m'],
      ['Operating margin', 20, 22, 21.4, '%'],
    ],
    peers: ['ARCL', 'CNVX', 'BRTN'],
    marketShare: null,
    moatScores: [3, 3, 5, 4, 3, 3, 3, 2, 4],
    narrative: EMPTY_NARRATIVE,
    hasOptions: true,
  },
  {
    ticker: 'HLVT',
    name: 'Helvetia Bancorp',
    exchange: 'SIX',
    currency: 'CHF',
    sector: 'Financials',
    industry: 'Diversified Banks',
    country: 'Switzerland',
    price: 71,
    drift: 0.07,
    vol: 0.21,
    revenue: 12800,
    revenueGrowth: 0.06,
    grossMargin: 0.61,
    operatingMargin: 0.38,
    netMargin: 0.28,
    eps: 6.9,
    epsGrowth: 0.05,
    shares: 520,
    netDebt: 4200,
    fcf: 3400,
    roic: 0.11,
    roe: 0.13,
    debtToEquity: 1.1,
    beta: 0.94,
    taxRate: 0.21,
    rnd: 180,
    dividend: 3.1,
    dividendGrowthYears: 11,
    lastCutYear: 2011,
    kpis: [
      ['Net interest margin', 1.82, '%'],
      ['Deposit growth', 3.4, '%'],
      ['Credit loss provisions', 420, 'CHF m'],
    ],
    guidance: [['Net interest income', 6100, 6350, 6220, 'CHF m']],
    peers: ['CNVX', 'ORBP', 'VLGR'],
    marketShare: [8.4, 8.1, 8.3],
    moatScores: [3, 3, 4, 2, 4, 3, 1, 4, 2],
    narrative: EMPTY_NARRATIVE,
    hasOptions: false,
  },
  {
    ticker: 'RVRT',
    name: 'Riverton Retail Group',
    exchange: 'NYSE',
    currency: 'USD',
    sector: 'Consumer Discretionary',
    industry: 'Broadline Retail',
    country: 'United States',
    price: 58,
    drift: 0.05,
    vol: 0.27,
    revenue: 41200,
    revenueGrowth: 0.04,
    grossMargin: 0.31,
    operatingMargin: 0.07,
    netMargin: 0.045,
    eps: 3.4,
    epsGrowth: 0.03,
    shares: 545,
    netDebt: 6800,
    fcf: 1450,
    roic: 0.1,
    roe: 0.16,
    debtToEquity: 0.86,
    beta: 1.05,
    taxRate: 0.23,
    rnd: 90,
    dividend: 1.44,
    dividendGrowthYears: 9,
    lastCutYear: null,
    kpis: [
      ['Comparable sales growth', 2.1, '%'],
      ['Digital sales mix', 34, '%'],
      ['Inventory turns', 5.6, 'x'],
    ],
    guidance: [['Comparable sales growth', 1.5, 2.5, 2.2, '%']],
    peers: ['VLGR', 'ZPHR', 'ORBP'],
    marketShare: [6.1, 5.9, 5.7],
    moatScores: [3, 4, 1, 1, 4, 4, 1, 1, 2],
    narrative: EMPTY_NARRATIVE,
    hasOptions: true,
  },
  {
    ticker: 'MDCR',
    name: 'Meridian Care Health',
    exchange: 'NYSE',
    currency: 'USD',
    sector: 'Health Care',
    industry: 'Pharmaceuticals',
    country: 'United States',
    price: 142,
    drift: 0.09,
    vol: 0.23,
    revenue: 24600,
    revenueGrowth: 0.08,
    grossMargin: 0.72,
    operatingMargin: 0.29,
    netMargin: 0.22,
    eps: 7.8,
    epsGrowth: 0.09,
    shares: 690,
    netDebt: 5200,
    fcf: 5600,
    roic: 0.17,
    roe: 0.21,
    debtToEquity: 0.54,
    beta: 0.78,
    taxRate: 0.18,
    rnd: 4100,
    dividend: 3.6,
    dividendGrowthYears: 14,
    lastCutYear: null,
    kpis: [
      ['Late-stage pipeline assets', 11, 'programmes'],
      ['Patent cliff exposure', 18, '% of revenue'],
    ],
    guidance: [['Adjusted EPS', 7.9, 8.3, 8.05, 'USD']],
    peers: ['AQFL', 'VLGR', 'HLVT'],
    marketShare: null,
    moatScores: [4, 2, 3, 1, 3, 3, 5, 4, 2],
    narrative: {
      innovation: ['Sample dataset lists eleven late-stage programmes across three therapy areas.'],
      capitalAllocation: ['Sample dataset shows dividend growth funded at a 46% FCF payout.'],
      threats: ['Biosimilar entry on two mature products.'],
      catalysts: ['Two phase-III readouts inside the sample event calendar.'],
      risks: ['Single-product revenue concentration above 20%.'],
    },
    hasOptions: true,
  },
  {
    ticker: 'TERA',
    name: 'Terra Energy',
    exchange: 'LSE',
    currency: 'GBP',
    sector: 'Energy',
    industry: 'Integrated Oil & Gas',
    country: 'United Kingdom',
    price: 44,
    drift: 0.06,
    vol: 0.3,
    revenue: 63400,
    revenueGrowth: -0.03,
    grossMargin: 0.28,
    operatingMargin: 0.14,
    netMargin: 0.09,
    eps: 5.1,
    epsGrowth: -0.06,
    shares: 1120,
    netDebt: 14200,
    fcf: 6900,
    roic: 0.12,
    roe: 0.15,
    debtToEquity: 0.61,
    beta: 1.12,
    taxRate: 0.31,
    rnd: 620,
    dividend: 2.4,
    dividendGrowthYears: 4,
    lastCutYear: 2020,
    kpis: [
      ['Production', 1.9, 'mmboe/d'],
      ['Realised price', 74, 'USD/boe'],
    ],
    guidance: [['Production', 1.85, 1.95, 1.9, 'mmboe/d']],
    peers: ['SLVM', 'AQFL', 'KNSU'],
    marketShare: null,
    moatScores: [2, 4, 1, 1, 5, 3, 2, 4, 1],
    narrative: EMPTY_NARRATIVE,
    hasOptions: false,
  },
  {
    ticker: 'AQFL',
    name: 'Aquafall Utilities',
    exchange: 'NYSE',
    currency: 'USD',
    sector: 'Utilities',
    industry: 'Multi-Utilities',
    country: 'United States',
    price: 66,
    drift: 0.04,
    vol: 0.16,
    revenue: 9800,
    revenueGrowth: 0.03,
    grossMargin: 0.42,
    operatingMargin: 0.23,
    netMargin: 0.13,
    eps: 3.2,
    epsGrowth: 0.04,
    shares: 400,
    netDebt: 11800,
    fcf: 720,
    roic: 0.07,
    roe: 0.1,
    debtToEquity: 1.42,
    beta: 0.58,
    taxRate: 0.22,
    rnd: 40,
    dividend: 2.6,
    dividendGrowthYears: 21,
    lastCutYear: null,
    kpis: [
      ['Rate base', 28400, 'USD m'],
      ['Allowed return on equity', 9.6, '%'],
    ],
    guidance: [['Adjusted EPS', 3.25, 3.4, 3.3, 'USD']],
    peers: ['TERA', 'ORBP', 'MDCR'],
    marketShare: null,
    moatScores: [2, 3, 3, 1, 4, 2, 1, 5, 1],
    narrative: EMPTY_NARRATIVE,
    hasOptions: false,
  },
  {
    ticker: 'KNSU',
    name: 'Kanso Industrial',
    exchange: 'TSE',
    currency: 'JPY',
    sector: 'Industrials',
    industry: 'Industrial Machinery',
    country: 'Japan',
    price: 3120,
    drift: 0.11,
    vol: 0.25,
    revenue: 1840000,
    revenueGrowth: 0.09,
    grossMargin: 0.36,
    operatingMargin: 0.15,
    netMargin: 0.11,
    eps: 214,
    epsGrowth: 0.12,
    shares: 940,
    netDebt: 96000,
    fcf: 132000,
    roic: 0.13,
    roe: 0.15,
    debtToEquity: 0.44,
    beta: 1.02,
    taxRate: 0.3,
    rnd: 78000,
    dividend: 82,
    dividendGrowthYears: 7,
    lastCutYear: null,
    kpis: [
      ['Order backlog', 1240000, 'JPY m'],
      ['Book-to-bill', 1.08, 'x'],
    ],
    guidance: [['Operating profit', 268000, 284000, 276000, 'JPY m']],
    peers: ['ARCL', 'SLVM', 'ZPHR'],
    marketShare: [4.8, 5.0, 5.2],
    moatScores: [3, 4, 3, 1, 4, 3, 4, 2, 2],
    narrative: EMPTY_NARRATIVE,
    hasOptions: false,
  },
  {
    ticker: 'VLGR',
    name: 'Valgren Foods',
    exchange: 'EURONEXT',
    currency: 'EUR',
    sector: 'Consumer Staples',
    industry: 'Packaged Foods',
    country: 'Netherlands',
    price: 92,
    drift: 0.05,
    vol: 0.17,
    revenue: 31600,
    revenueGrowth: 0.035,
    grossMargin: 0.44,
    operatingMargin: 0.16,
    netMargin: 0.11,
    eps: 4.6,
    epsGrowth: 0.05,
    shares: 760,
    netDebt: 8900,
    fcf: 2600,
    roic: 0.12,
    roe: 0.18,
    debtToEquity: 0.72,
    beta: 0.66,
    taxRate: 0.24,
    rnd: 410,
    dividend: 2.85,
    dividendGrowthYears: 18,
    lastCutYear: null,
    kpis: [
      ['Organic growth', 3.2, '%'],
      ['Price/mix contribution', 2.1, '%'],
    ],
    guidance: [['Organic growth', 3, 4, 3.4, '%']],
    peers: ['RVRT', 'MDCR', 'AQFL'],
    marketShare: [3.4, 3.4, 3.3],
    moatScores: [5, 3, 2, 1, 4, 5, 2, 2, 2],
    narrative: EMPTY_NARRATIVE,
    hasOptions: false,
  },
  {
    ticker: 'ORBP',
    name: 'Orbital Properties REIT',
    exchange: 'NYSE',
    currency: 'USD',
    sector: 'Real Estate',
    industry: 'Diversified REITs',
    country: 'United States',
    price: 38,
    drift: 0.03,
    vol: 0.22,
    revenue: 4200,
    revenueGrowth: 0.045,
    grossMargin: 0.66,
    operatingMargin: 0.34,
    netMargin: 0.19,
    eps: 1.65,
    epsGrowth: 0.04,
    shares: 480,
    netDebt: 9600,
    fcf: 640,
    roic: 0.06,
    roe: 0.08,
    debtToEquity: 1.18,
    beta: 0.92,
    taxRate: 0.05,
    rnd: 0,
    dividend: 2.1,
    dividendGrowthYears: 5,
    lastCutYear: 2021,
    kpis: [
      ['Occupancy', 93.4, '%'],
      ['Weighted average lease term', 6.2, 'years'],
    ],
    guidance: [['Funds from operations per share', 3.1, 3.25, 3.18, 'USD']],
    peers: ['AQFL', 'HLVT', 'RVRT'],
    marketShare: null,
    moatScores: [2, 3, 3, 1, 3, 2, 1, 3, 1],
    narrative: EMPTY_NARRATIVE,
    hasOptions: false,
  },
  {
    ticker: 'SLVM',
    name: 'Silvermoor Materials',
    exchange: 'ASX',
    currency: 'AUD',
    sector: 'Materials',
    industry: 'Diversified Metals & Mining',
    country: 'Australia',
    price: 54,
    drift: 0.08,
    vol: 0.33,
    revenue: 22800,
    revenueGrowth: 0.02,
    grossMargin: 0.38,
    operatingMargin: 0.21,
    netMargin: 0.14,
    eps: 4.3,
    epsGrowth: -0.02,
    shares: 740,
    netDebt: 3100,
    fcf: 2900,
    roic: 0.15,
    roe: 0.19,
    debtToEquity: 0.38,
    beta: 1.24,
    taxRate: 0.3,
    rnd: 210,
    dividend: 2.15,
    dividendGrowthYears: 3,
    lastCutYear: 2019,
    kpis: [
      ['Copper production', 640, 'kt'],
      ['All-in sustaining cost', 2.1, 'USD/lb'],
    ],
    guidance: [['Copper production', 620, 660, 645, 'kt']],
    peers: ['TERA', 'KNSU', 'ARCL'],
    marketShare: null,
    moatScores: [1, 5, 1, 1, 4, 2, 1, 3, 1],
    narrative: EMPTY_NARRATIVE,
    hasOptions: false,
  },
  {
    ticker: 'CNVX',
    name: 'Convex Payments',
    exchange: 'NYSE',
    currency: 'USD',
    sector: 'Financials',
    industry: 'Transaction Processing',
    country: 'United States',
    price: 212,
    drift: 0.15,
    vol: 0.29,
    revenue: 14100,
    revenueGrowth: 0.16,
    grossMargin: 0.68,
    operatingMargin: 0.41,
    netMargin: 0.31,
    eps: 8.4,
    epsGrowth: 0.18,
    shares: 520,
    netDebt: 2600,
    fcf: 4800,
    roic: 0.24,
    roe: 0.31,
    debtToEquity: 0.47,
    beta: 1.08,
    taxRate: 0.2,
    rnd: 1150,
    dividend: 1.1,
    dividendGrowthYears: 8,
    lastCutYear: null,
    kpis: [
      ['Payment volume', 2140, 'USD bn'],
      ['Take rate', 0.66, '%'],
    ],
    guidance: [['Revenue growth', 14, 17, 15.5, '%']],
    peers: ['NBLA', 'HLVT', 'ARCL'],
    marketShare: [21.4, 22.6, 23.4],
    moatScores: [4, 3, 4, 5, 5, 4, 3, 3, 4],
    narrative: {
      innovation: ['Sample dataset records real-time settlement rails shipped in two regions.'],
      capitalAllocation: ['Sample dataset shows tuck-in acquisitions at 11x forward EBITDA.'],
      threats: ['Account-to-account rails bypassing card networks.'],
      catalysts: ['Renewal of two top-ten merchant contracts.'],
      risks: ['Interchange regulation in the sample regulatory calendar.'],
    },
    hasOptions: true,
  },
  {
    ticker: 'BRTN',
    name: 'Brightline Telecom',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Communication Services',
    industry: 'Integrated Telecommunication Services',
    country: 'United States',
    price: 24,
    drift: 0.02,
    vol: 0.2,
    revenue: 38400,
    revenueGrowth: 0.01,
    grossMargin: 0.54,
    operatingMargin: 0.18,
    netMargin: 0.08,
    eps: 1.9,
    epsGrowth: 0.01,
    shares: 1620,
    netDebt: 42600,
    fcf: 3900,
    roic: 0.05,
    roe: 0.09,
    debtToEquity: 1.64,
    beta: 0.71,
    taxRate: 0.24,
    rnd: 320,
    dividend: 1.2,
    dividendGrowthYears: 0,
    lastCutYear: 2022,
    kpis: [
      ['Postpaid net adds', 214, 'thousand'],
      ['Churn', 0.94, '%'],
    ],
    guidance: [['Free cash flow', 3700, 4100, 3950, 'USD m']],
    peers: ['NBLA', 'AQFL', 'RVRT'],
    marketShare: [18.9, 18.4, 18.1],
    moatScores: [2, 3, 3, 2, 4, 3, 2, 4, 2],
    narrative: EMPTY_NARRATIVE,
    hasOptions: true,
  },
  {
    ticker: 'ZPHR',
    name: 'Zephyr Mobility',
    exchange: 'XETRA',
    currency: 'EUR',
    sector: 'Consumer Discretionary',
    industry: 'Automobile Manufacturers',
    country: 'Germany',
    price: 78,
    drift: 0.07,
    vol: 0.35,
    revenue: 96400,
    revenueGrowth: 0.06,
    grossMargin: 0.21,
    operatingMargin: 0.08,
    netMargin: 0.055,
    eps: 9.1,
    epsGrowth: 0.07,
    shares: 580,
    netDebt: 12400,
    fcf: 4100,
    roic: 0.09,
    roe: 0.14,
    debtToEquity: 0.78,
    beta: 1.29,
    taxRate: 0.28,
    rnd: 7400,
    dividend: 3.4,
    dividendGrowthYears: 2,
    lastCutYear: 2020,
    kpis: [
      ['Unit deliveries', 2.4, 'million'],
      ['Battery-electric mix', 38, '%'],
    ],
    guidance: [['Operating margin', 7.5, 8.5, 8.1, '%']],
    peers: ['KNSU', 'RVRT', 'SLVM'],
    marketShare: [5.6, 5.4, 5.5],
    moatScores: [4, 2, 2, 1, 4, 4, 3, 2, 2],
    narrative: EMPTY_NARRATIVE,
    hasOptions: false,
  },
]

function provenanceFor(currency: string, source = DATA_SOURCE): Provenance {
  return {
    provider: DATA_PROVIDER,
    source,
    asOf: AS_OF,
    retrievedAt: RETRIEVED_AT,
    currency,
  }
}

/** Business days ending on `AS_OF`, oldest first. */
export function tradingDates(count: number, end = AS_OF): string[] {
  const dates: string[] = []
  const cursor = new Date(`${end}T00:00:00.000Z`)
  while (dates.length < count) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return dates.reverse()
}

function buildPrices(seed: Seed, dates: string[]): PricePoint[] {
  const random = createRandom(hashString(seed.ticker))
  const dailyDrift = seed.drift / TRADING_DAYS
  const dailyVol = seed.vol / Math.sqrt(TRADING_DAYS)
  const returns = dates.map(() => dailyDrift + dailyVol * normalFrom(random))
  const total = returns.reduce((sum, value) => sum + value, 0)
  let price = seed.price / Math.exp(total)
  return dates.map((date, index) => {
    price *= Math.exp(returns[index])
    const range = price * (0.004 + random() * 0.012)
    return {
      date,
      close: round(price, 2),
      high: round(price + range, 2),
      low: round(price - range, 2),
      volume: Math.round((1_000_000 + random() * 4_000_000) * (seed.shares / 500)),
    }
  })
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function buildEarnings(seed: Seed): EarningsQuarter[] {
  const random = createRandom(hashString(`${seed.ticker}-earnings`))
  const quarters: EarningsQuarter[] = []
  for (let index = 3; index >= 0; index -= 1) {
    const consensusEps = round((seed.eps / 4) * (1 - index * seed.epsGrowth * 0.1), 2)
    const surprise = (random() - 0.4) * 0.08
    const consensusRevenue = round((seed.revenue / 4) * (1 - index * 0.015), 1)
    const revenueSurprise = (random() - 0.45) * 0.03
    const year = 2026 - Math.floor((index + 1) / 4)
    const quarter = ((6 - index + 3) % 4) + 1
    quarters.push({
      period: `Q${quarter} ${year}`,
      reportDate: quarterReportDate(year, quarter),
      epsReported: round(consensusEps * (1 + surprise), 2),
      epsConsensus: consensusEps,
      revenueReported: round(consensusRevenue * (1 + revenueSurprise), 1),
      revenueConsensus: consensusRevenue,
      priceReactionPercent: round((surprise * 100 + (random() - 0.5) * 2) * 1.4, 2),
    })
  }
  return quarters
}

function quarterReportDate(year: number, quarter: number): string {
  const month = String(quarter * 3 + 1 > 12 ? 1 : quarter * 3 + 1).padStart(2, '0')
  const reportYear = quarter * 3 + 1 > 12 ? year + 1 : year
  return `${reportYear}-${month}-24`
}

function buildFundamentals(seed: Seed, prices: PricePoint[]): Fundamentals {
  const last = prices[prices.length - 1].close
  const yearAgo = prices[Math.max(0, prices.length - 253)].close
  const marketCap = round(last * seed.shares, 1)
  const ebitda = seed.revenue * seed.operatingMargin + seed.revenue * 0.05
  const returns = dailyReturns(prices.map((point) => point.close))
  return {
    marketCap,
    revenue: seed.revenue,
    revenueGrowth: seed.revenueGrowth,
    epsGrowth: seed.epsGrowth,
    eps: seed.eps,
    peRatio: round(last / seed.eps, 2),
    forwardPe: round(last / (seed.eps * (1 + seed.epsGrowth)), 2),
    pegRatio: round(last / seed.eps / Math.max(seed.epsGrowth * 100, 0.1), 2),
    evToEbitda: round((marketCap + seed.netDebt) / ebitda, 2),
    priceToFcf: round(marketCap / seed.fcf, 2),
    roic: seed.roic,
    roe: seed.roe,
    grossMargin: seed.grossMargin,
    operatingMargin: seed.operatingMargin,
    netMargin: seed.netMargin,
    debtToEquity: seed.debtToEquity,
    freeCashFlow: seed.fcf,
    dividendYield: round((seed.dividend / last) * 100, 2),
    payoutRatio: round(seed.dividend / seed.eps, 3),
    momentum12m: round(((last - yearAgo) / yearAgo) * 100, 2),
    volatility: round(standardDeviation(returns) * Math.sqrt(TRADING_DAYS) * 100, 2),
    beta: seed.beta,
    dilutedShares: seed.shares,
    netDebt: seed.netDebt,
    taxRate: seed.taxRate,
    depreciation: round(seed.revenue * 0.05, 1),
    capex: round(seed.revenue * 0.07, 1),
    workingCapitalChange: round(seed.revenue * 0.01, 1),
    researchAndDevelopment: seed.rnd,
  }
}

export function dailyReturns(series: number[]): number[] {
  const returns: number[] = []
  for (let index = 1; index < series.length; index += 1) {
    returns.push((series[index] - series[index - 1]) / series[index - 1])
  }
  return returns
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function buildMoat(seed: Seed): MoatDimension[] {
  return MOAT_DIMENSIONS.map((dimension, index) => ({
    dimension,
    score: seed.moatScores[index],
    evidence: `Sample factor sheet scores ${dimension.toLowerCase()} ${seed.moatScores[index]}/5.`,
  }))
}

function buildCompany(seed: Seed, dates: string[]): CompanyRecord {
  const prices = buildPrices(seed, dates)
  const fundamentals = buildFundamentals(seed, prices)
  const last = prices[prices.length - 1].close
  const random = createRandom(hashString(`${seed.ticker}-meta`))
  const security: Security = {
    ticker: seed.ticker,
    name: seed.name,
    exchange: seed.exchange,
    currency: seed.currency,
    sector: seed.sector,
    industry: seed.industry,
    country: seed.country,
  }
  return {
    security,
    fundamentals,
    prices,
    nextEarningsDate: '2026-10-22',
    earnings: buildEarnings(seed),
    kpis: seed.kpis.map(([label, value, unit]) => ({
      label,
      value,
      unit,
      period: 'Q2 2026',
    })),
    guidance: seed.guidance.map(([metric, low, high, consensus, unit]) => ({
      metric,
      low,
      high,
      consensus,
      unit,
    })),
    dividend:
      seed.dividend > 0
        ? {
            annualDividend: seed.dividend,
            paymentsPerYear: 4,
            exDividendDate: '2026-11-06',
            payoutRatio: round(seed.dividend / seed.eps, 3),
            fcfPayoutRatio: round((seed.dividend * seed.shares) / seed.fcf, 3),
            consecutiveGrowthYears: seed.dividendGrowthYears,
            cagr3y: seed.dividendGrowthYears >= 3 ? round(0.02 + random() * 0.08, 4) : null,
            cagr5y: seed.dividendGrowthYears >= 5 ? round(0.02 + random() * 0.07, 4) : null,
            cagr10y: seed.dividendGrowthYears >= 10 ? round(0.02 + random() * 0.06, 4) : null,
            lastCutYear: seed.lastCutYear,
          }
        : null,
    ownership: {
      institutionalPercent: round(45 + random() * 40, 1),
      insiderPercent: round(random() * 8, 1),
      shortInterestPercent: round(0.5 + random() * 6, 1),
    },
    insiders: [
      {
        date: '2026-08-14',
        person: 'Chief Executive Officer',
        type: random() > 0.5 ? 'buy' : 'sell',
        shares: Math.round(5_000 + random() * 40_000),
        value: Math.round(last * (5_000 + random() * 40_000)),
      },
      {
        date: '2026-06-03',
        person: 'Chief Financial Officer',
        type: random() > 0.6 ? 'buy' : 'sell',
        shares: Math.round(2_000 + random() * 20_000),
        value: Math.round(last * (2_000 + random() * 20_000)),
      },
    ],
    options: seed.hasOptions
      ? {
          expiry: '2026-10-30',
          underlyingPrice: last,
          atmCall: round(last * (0.028 + random() * 0.02), 2),
          atmPut: round(last * (0.026 + random() * 0.02), 2),
        }
      : null,
    peers: seed.peers,
    marketShare: seed.marketShare
      ? seed.marketShare.map((sharePercent, index) => ({
          year: 2024 + index,
          sharePercent,
        }))
      : null,
    moat: buildMoat(seed),
    innovation: seed.narrative.innovation,
    capitalAllocation: seed.narrative.capitalAllocation,
    threats: seed.narrative.threats,
    catalysts: seed.narrative.catalysts,
    risks: seed.narrative.risks,
    provenance: provenanceFor(seed.currency),
  }
}

const DATES = tradingDates(TRADING_DAYS)

export const UNIVERSE: CompanyRecord[] = SEEDS.map((seed) => buildCompany(seed, DATES))

/** Broad market proxy used for beta, relative strength and benchmarking. */
export const MARKET_INDEX: PricePoint[] = buildPrices(
  {
    ...SEEDS[0],
    ticker: 'SMPX',
    price: 4800,
    drift: 0.09,
    vol: 0.16,
    shares: 500,
  },
  DATES,
)

export const MARKET_INDEX_NAME = 'Sample Broad Market Index (SMPX)'

const BY_TICKER = new Map(UNIVERSE.map((company) => [company.security.ticker, company]))

export function getCompany(ticker: string): CompanyRecord | undefined {
  return BY_TICKER.get(ticker.trim().toUpperCase())
}

/** Search by company name, ticker or exchange. */
export function searchSecurities(query: string, limit = 8): Security[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return []
  return UNIVERSE.map((company) => company.security)
    .filter(
      (security) =>
        security.ticker.toLowerCase().includes(needle) ||
        security.name.toLowerCase().includes(needle) ||
        security.exchange.toLowerCase().includes(needle),
    )
    .sort((a, b) => rank(a, needle) - rank(b, needle) || a.ticker.localeCompare(b.ticker))
    .slice(0, limit)
}

/** Exact ticker matches rank first, then ticker prefix, then company name. */
export function rank(security: Security, needle: string): number {
  if (security.ticker.toLowerCase() === needle) return 0
  if (security.ticker.toLowerCase().startsWith(needle)) return 1
  if (security.name.toLowerCase().startsWith(needle)) return 2
  return 3
}

export const SECTORS = [...new Set(UNIVERSE.map((company) => company.security.sector))].sort()
export const COUNTRIES = [...new Set(UNIVERSE.map((company) => company.security.country))].sort()
