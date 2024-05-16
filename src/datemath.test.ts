import { expect, test } from "vitest";
import { SafeDate } from "./datemath";

// This is done via environment variable
test('Timezone set correctly', () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  expect(tz).toBe("Europe/London");
})

test('new SafeDate()', () => {
  const date = new SafeDate(2024, 1, 23);
  expect(date.year).toBe(2024);
  expect(date.month).toBe(1);
  expect(date.day).toBe(23);
  expect(date.convert().toISOString()).toBe("2024-01-23T00:00:00.000Z");
})

test('addDays', () => {
  const date = new SafeDate(2024, 1, 23).addDays(10);
  expect(date.year).toBe(2024);
  expect(date.month).toBe(2);
  expect(date.day).toBe(2);
})

test('addDays across timezones', () => {
  const date = new SafeDate(2024, 3, 9).addDays(2);
  expect(date.convert().toISOString()).toBe("2024-03-11T00:00:00.000Z");

  const date2 = new SafeDate(2024, 3, 11).addDays(-2);
  expect(date2.convert().toISOString()).toBe("2024-03-09T00:00:00.000Z");

  const date3 = new SafeDate(2023, 10, 28).addDays(2);
  expect(date3.convert().toISOString()).toBe("2023-10-30T00:00:00.000Z");
  const date4 = new SafeDate(2023, 10, 30).addDays(-2);
  expect(date4.convert().toISOString()).toBe("2023-10-28T00:00:00.000Z");

})

test('String convert works across DST transitions', () => {
  // DST transitions
  const date = new SafeDate(2024, 3, 9).addDays(2);
  expect(date.toLocaleDateString("en-AU")).toBe("11/03/2024");

  const date2 = new SafeDate(2023, 10, 28).addDays(2);
  expect(date2.toLocaleDateString("en-AU")).toBe("30/10/2023");
});
