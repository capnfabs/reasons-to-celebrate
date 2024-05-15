import { SafeDate } from "./datemath";

export const MILLIS_TO_DAYS = 1 / (1000 * 60 * 60 * 24);

const NUMBER_FORMAT = new Intl.NumberFormat();
// This is a tuple of [label, number of days] representing a milestone.
// if label = '' then it will be filled with NUMBER_FORMAT.format(number).
// otherwise, it'll be transformed to `${label} (${NUMBER_FORMAT.format(number)})`,
// e.g. π (31,415)
const LIST_OF_SIGNIFICANT_DAYCOUNTS = (() => {
  const milestones: [string, number][] = [];
  // not so many people live to 121 years == ~44k days
  for (var i = 1; i < 45; i++) {
    milestones.push(['', i*1000]);
  }

  // This code should probably:
  // choose 3 from the 1000s
  // add at least one special number from each category if they're possible

  milestones.push(
    ['', 1234],
    ['', 12345],
    ["π", 3141],
    ["π", 31415],
    ['', 1111],
    ['', 2222],
    ['', 3333],
    ['', 4444],
    ['', 5555],
    ['', 6666],
    ['', 7777],
    ['', 8888],
    ['', 9999],
    ['', 11111],
    ['', 22222],
    ['', 33333],
    ['', 44444],
  )
  milestones.sort((a, b) => a[1] - b[1]);
  return milestones;
})();

export type Milestone = {
  formattedLabel: string,
  date: SafeDate,
}

function stripLeadingZeroes(val: string): string {
  return val.replace(/^0+/, '') || '0';
}

// returns a number that's loosely a representation of the user's birthday.
// We try to target a 5-digit number because most people reading this will be
// between 10k-30k days old.
// This also works with locales, i.e. en-US gets month-first.
export const buildBirthdayNumber = (date: SafeDate, locale?: string): [string, number] => {
  const format = new Intl.DateTimeFormat(locale, {timeZone: 'UTC'}).formatToParts(date.convert());
  // to generate the number, filter out slashes, dots etc.
  const numFormat = format.filter((x) => x.type !== "literal");

  // if the first number only has one digit, then zero-pad both the first and second numbers.
  const shouldPadDayAndMonthFields = numFormat.map((x) => stripLeadingZeroes(x.value))[0].length === 1;

  const runFormatter = (formatter: typeof format): string => formatter.map((component) => {
    switch (component.type) {
      case "day":
      case "month":
        const componentVal = stripLeadingZeroes(component.value);
        if (shouldPadDayAndMonthFields && componentVal.length === 1) {
          return "0" + componentVal;
        } else {
          return componentVal;
        }
      case "year":
        return component.value.substring(2);
      case "literal":
        return component.value;
    }
  }).join("");

  // we might have a leading zero, so force base-10.
  const magicNum = parseInt(runFormatter(numFormat), 10);
  const formatted = runFormatter(format);

  return [formatted, magicNum];
}

function formatLabel(label: string, days: number): string {
  const num_days = NUMBER_FORMAT.format(days);
  if (label) {
    return `${label} (${NUMBER_FORMAT.format(days)})`;
  } else {
    return num_days;
  }
}

// given a sorted `array`, find the first index >= startValue and the first index >= endValue.
// assumes startValue <= endValue
function findRange(array: number[], startValue: number, endValue?: number): [number?, number?] {
  var startIdx = null;
  var endIdx = null;
  var i = 0;
  for (i = 0; i < array.length; i++) {
    if (array[i] >= startValue) {
      startIdx = i;
      break;
    }
  }
  i++;
  if (endValue !== undefined) {
    for (; i < array.length; i++) {
      if (array[i] >= endValue) {
        endIdx = i;
        break
      }
    }
  }
  startIdx ||= array.length;
  endIdx ||= array.length;
  return [startIdx, endIdx];
}

export const computeMilestones = (startDate: SafeDate, earliest?: SafeDate, latest?: SafeDate, limit?: number): Milestone[] => {
  if (!startDate) {
    return [];
  }
  earliest = earliest || SafeDate.today().addDays(-60);

  // filter out days that are 'too historical'
  // list is presorted so doing this now is a good perf optimisation
  const earliestDayCutoff = SafeDate.daysBetween(earliest, startDate);
  const latestDayCutoff = latest && SafeDate.daysBetween(latest, startDate);

  const [startIdx, endIdxExclusive] = findRange(LIST_OF_SIGNIFICANT_DAYCOUNTS.map(([,num]) => num), earliestDayCutoff, latestDayCutoff);

  const dayCounts = LIST_OF_SIGNIFICANT_DAYCOUNTS.slice(startIdx, endIdxExclusive);

  const [label, birthdayNum] = buildBirthdayNumber(startDate);

  if (birthdayNum >= earliestDayCutoff && (latestDayCutoff === undefined || birthdayNum <= latestDayCutoff)) {
    // only insert if it's within range
    dayCounts.push([label, birthdayNum]);
    dayCounts.sort((a, b) => a[1] - b[1]);
  }

  const mapped: Milestone[] = dayCounts.slice(0, limit).map(([label, days]) => ({formattedLabel: formatLabel(label, days), date: startDate.addDays(days)}));
  console.log(mapped);
  return mapped;
};

export function computeMilestonesForLotsOfPeople<T>(people: T[], getBirthday: (person: T) => SafeDate, earliest?: SafeDate, latest?: SafeDate): [T, Milestone][] {
  // can we compute max milestones based on the date range?
  // this has to be O(people*milestones)
  earliest = earliest || SafeDate.today().addDays(-60);
  latest = latest || SafeDate.today().addDays(3*365 + 1);

  const result: [T, Milestone][] = people.flatMap((person) => {
    const birthday = getBirthday(person);
    const milestones = computeMilestones(birthday, earliest, latest);
    return milestones.map<[T, Milestone]>((m) => [person, m]);
  });
  result.sort(([,a], [,b]) => SafeDate.daysBetween(a.date, b.date));
  return result;
}
