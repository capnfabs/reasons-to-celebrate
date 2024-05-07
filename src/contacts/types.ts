export type CalendarDate = {year?: number, month?: number, day?: number}

export type UserSuppliedContact = {
  name: string;
  birthdayRawText?: string;
  birthdayParsed?: CalendarDate;
}
