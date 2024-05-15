import { SafeDate } from "../datemath";
import { filterMap } from "../util";
import { CalendarDate, UserSuppliedContact } from "./types";

export type ValidContact = {
  name: string,
  birthday: SafeDate
}

function birthdateValid(birthday: CalendarDate): birthday is {day: number, month: number, year: number} {
  return !!(birthday.day && birthday.month && birthday.year && birthday.year >= 1900);
}

export function selectValidContacts(contacts: UserSuppliedContact[]): ValidContact[] {
  return filterMap(contacts, (c) => {
    if (c.birthdayParsed && birthdateValid(c.birthdayParsed)) {
      return {
        name: c.name,
        birthday: new SafeDate(
          c.birthdayParsed.year,
          c.birthdayParsed.month,
          c.birthdayParsed.day
        )
      }
    }
  });
}
