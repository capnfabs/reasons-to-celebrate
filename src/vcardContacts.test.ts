import vCard from 'vcf';
import {extractBirthday} from './vcardContacts';

import { expect, test } from 'vitest'

test('handles undefined bday', () => {
  const result = extractBirthday(undefined);
  expect(result).toBe(null);
});

test.each([
  ["19960415", {year: "1996", month: "04", day: "15"}],
  ["1996-04-15", {year: "1996", month: "04", day: "15"}],
  ["--0415", {year: undefined, month: "04", day: "15"}],
  ["19531015T231000Z", {year: "1953", month: "10", day: "15"}],
  ["1987-09-27T08:30:00-06:00", {year: "1987", month: "09", day: "27"}],
]) ('handles %s', (input: string, expected: ReturnType<typeof extractBirthday>) => {
  const bdayProp = new vCard.Property("bday", input);
  const result = extractBirthday(bdayProp);
  expect(result).toStrictEqual(expected);
});

test('handles something with X-APPLE-OMIT-YEAR', () => {
  const prop = new vCard.Property("bday", "1604-05-11", {'xAppleOmitYear':'1604'});
  const result = extractBirthday(prop);
  expect(result).toStrictEqual({year: undefined, month: "05", day: "11"});
});
