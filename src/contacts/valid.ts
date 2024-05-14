import { filterMap } from "../util";
import { CalendarDate, UserSuppliedContact } from "./types";

export type ValidContact = {
  name: string,
  birthday: Date
}

function birthdateValid(birthday: CalendarDate): birthday is {day: number, month: number, year: number} {
  return !!(birthday.day && birthday.month && birthday.year && birthday.year >= 1900);
}

export function selectValidContacts(contacts: UserSuppliedContact[]): ValidContact[] {
  return filterMap(contacts, (c) => {
    if (c.birthdayParsed && birthdateValid(c.birthdayParsed)) {
      return {
        name: c.name,
        birthday: new Date(
          c.birthdayParsed.year,
          // month is zero-indexed, RIP
          c.birthdayParsed.month - 1,
          c.birthdayParsed.day)
      }
    }
  });
}
