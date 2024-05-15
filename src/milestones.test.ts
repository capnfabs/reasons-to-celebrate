import { expect, test } from "vitest";
import { SafeDate } from "./datemath";
import { buildBirthdayNumber } from "./milestones";

test.each([
  ["en-US", new SafeDate(1989, 6, 15), "06/15/89", 61589],
  ["en-US", new SafeDate(1989, 6, 2), "06/02/89", 60289],
  ["en-US", new SafeDate(1989, 11, 2), "11/2/89", 11289],
  ["en-US", new SafeDate(1989, 11, 22), "11/22/89", 112289],
  ["en-AU", new SafeDate(1989, 6, 15), "15/6/89", 15689],
  ["en-AU", new SafeDate(1989, 6, 2), "02/06/89", 20689],
  ["en-AU", new SafeDate(1989, 11, 2), "02/11/89", 21189],
  ["en-AU", new SafeDate(1989, 11, 22), "22/11/89", 221189],
  ["de-DE", new SafeDate(1989, 6, 15), "15.6.89", 15689],
  ["de-DE", new SafeDate(1989, 6, 2), "02.06.89", 20689],
  ["de-DE", new SafeDate(1989, 11, 2), "02.11.89", 21189],
  ["de-DE", new SafeDate(1989, 11, 22), "22.11.89", 221189],
])('handles %s / %s', (locale: string, date: SafeDate, expectedString: string, expectedNumber: number) => {
  const [label, number] = buildBirthdayNumber(date, locale);
  expect(label).toBe(expectedString);
  expect(number).toBe(expectedNumber);
});
