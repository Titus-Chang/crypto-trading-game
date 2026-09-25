export interface Candle {
  /** bucket start, in simulated minutes */
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface Bar {
  o: number
  h: number
  l: number
  c: number
  v: number
}

/** Aggregates one-minute bars into candles of a fixed timeframe. */
export class CandleSeries {
  readonly candles: Candle[] = []

  constructor(
    readonly tf: number,
    private readonly maxLen = 1500,
  ) {}

  push(minute: number, bar: Bar) {
    const bucket = Math.floor(minute / this.tf) * this.tf
    const last = this.candles[this.candles.length - 1]
    if (last && last.t === bucket) {
      last.h = Math.max(last.h, bar.h)
      last.l = Math.min(last.l, bar.l)
      last.c = bar.c
      last.v += bar.v
      return
    }
    this.candles.push({ t: bucket, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v })
    if (this.candles.length > this.maxLen) this.candles.shift()
  }

  get last(): Candle | undefined {
    return this.candles[this.candles.length - 1]
  }
}
