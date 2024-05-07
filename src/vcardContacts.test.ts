import vCard from 'vcf';
import {CalendarDate, extractBirthday} from './vcardContacts';

import { expect, test } from 'vitest'

test('handles undefined bday', () => {
  const [text, result] = extractBirthday(undefined);
  expect(text).toBe(undefined);
  expect(result).toBe(undefined);
});

test.each([
  ["19960415", {year: 1996, month: 4, day: 15}],
  ["1996-04-15", {year: 1996, month: 4, day: 15}],
  ["--0415", {year: undefined, month: 4, day: 15}],
  ["19531015T231000Z", {year: 1953, month: 10, day: 15}],
  ["1987-09-27T08:30:00-06:00", {year: 1987, month: 9, day: 27}],
]) ('handles %s', (input: string, expected: CalendarDate) => {
  const bdayProp = new vCard.Property("bday", input);
  const [text, result] = extractBirthday(bdayProp);
  expect(text).toEqual(input);
  expect(result).toStrictEqual(expected);
});

test('handles something with X-APPLE-OMIT-YEAR', () => {
  const prop = new vCard.Property("bday", "1604-05-11", {'xAppleOmitYear':'1604'});
  const [text, result] = extractBirthday(prop);
  expect(text).toEqual('1604-05-11');
  expect(result).toStrictEqual({year: undefined, month: 5, day: 11});
});
