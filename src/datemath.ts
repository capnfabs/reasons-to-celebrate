import { MILLIS_TO_DAYS } from "./milestones";

export class SafeDate {
  year: number;
  month: number;
  day: number;

  constructor(year: number, month: number, day: number) {
    // convert everything to ints
    this.year = year | 0;
    this.month = month | 0;
    this.day = day | 0;
  }

  public addDays(days: number): SafeDate {
    const date = this.convert();
    date.setUTCDate(date.getUTCDate() + days);
    return SafeDate.convertBack(date);
  }

  // begrudgingly, this is required
  public convert(): Date {
    return new Date(Date.UTC(this.year, this.month - 1, this.day));
  }

  private static convertBack(date: Date): SafeDate {
    if (import.meta.env.DEV) {
      if (date.getUTCHours() || date.getUTCMinutes()) {
        throw(`bad date: ${date}`)
      }
    }
    return new SafeDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  public static truncateToDate(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  public static today(): SafeDate {
    return this.convertBack(this.truncateToDate(new Date()));
  }

  public static daysBetween(a: SafeDate, b: SafeDate): number {
    return (a.convert().getTime() - b.convert().getTime()) * MILLIS_TO_DAYS;
  }

  public static equals(a: SafeDate, b: SafeDate): boolean {
    return a.day === b.day && a.month === b.month && a.year === b.year;
  }

  public toLocaleDateString(): string {
    return this.convert().toLocaleDateString(undefined, {
      timeZone: 'UTC',
    });
  }

  public static fromString(value: string): SafeDate {
    // TODO do we need to handle NaNs?
    const x = new Date(value);
    return this.convertBack(x);
  }
}
