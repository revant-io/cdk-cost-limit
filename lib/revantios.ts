export class Revantios {
  constructor(private _amount: number) {}
  static fromUSD = (amountUSD: number | string): Revantios => {
    return new this(Math.round(Number(amountUSD) * 10000000000));
  };

  static fromCents = (amountUSD: number | string): Revantios => {
    return new this(Math.round(Number(amountUSD) * 100000000));
  };

  public toString = (): string => this._amount.toString();

  public toRate = (duration: number): number =>
    Math.round(this._amount / duration);

  public toCents = (): number => Math.round(this._amount / 100000000);

  public get amount() {
    return this._amount;
  }
}
