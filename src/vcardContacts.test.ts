import {extractBirthday} from './vcardContacts';

import { expect, test } from 'vitest'

test('works', () => {
  const bdayProp = undefined;
  const result = extractBirthday(bdayProp);
  expect(result).toBe(null);
});
