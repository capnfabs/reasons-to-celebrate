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


const addDays = (date: Date, days: number) => {
  const d = new Date(date.valueOf());
  d.setDate(date.getDate() + days);
  return d;
}


// returns a number that's loosely a representation of the user's birthday.
// We try to target a 5-digit number because most people reading this will be
// between 10k-30k days old.
// This also works with locales, i.e. en-US gets month-first.
const buildBirthdayNumber = (date: Date, locale?: string): [string, number] => {
  const format = new Intl.DateTimeFormat(locale).formatToParts(date);
  // to generate the number, filter out slashes, dots etc.
  const numFormat = format.filter((x) => x.type !== "literal");

  // if the first number only has one digit, then zero-pad both the first and second numbers.
  const shouldPadDayAndMonthFields = numFormat.map((x) => x.value)[0].length === 1;

  const runFormatter = (formatter: typeof format): string => formatter.map((component) => {
    switch (component.type) {
      case "day":
      case "month":
        if (shouldPadDayAndMonthFields && component.value.length === 1) {
          return "0" + component.value;
        } else {
          return component.value;
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


export const computeMilestones = (startDate: Date): [string, Date][] => {
  if (!startDate) {
    return [];
  }

  const dayCutoff = (new Date().getTime() - startDate.getTime()) * MILLIS_TO_DAYS;
  var relevantStartIdx = 0;
  for (var i = 0; i < LIST_OF_SIGNIFICANT_DAYCOUNTS.length; i++) {
    if (LIST_OF_SIGNIFICANT_DAYCOUNTS[i][1] >= dayCutoff) {
      relevantStartIdx = i;
      break;
    }
  }
  if (relevantStartIdx > LIST_OF_SIGNIFICANT_DAYCOUNTS.length) {
    // don't blow past end of the array
    // TODO add better handling for people messing with really really old birthdays
    relevantStartIdx = 0;
  }

  const dayCounts = LIST_OF_SIGNIFICANT_DAYCOUNTS.slice(relevantStartIdx);

  const [label, birthdayNum] = buildBirthdayNumber(startDate);
  dayCounts.push([label, birthdayNum]);
  dayCounts.sort((a, b) => a[1] - b[1]);

  const mapped: [string, Date][] = dayCounts.map(([label, days]) => [formatLabel(label, days), addDays(startDate, days)]);
  const thirty_days_ago = addDays(new Date(), -30);
  return mapped.filter(([,date]) => date > thirty_days_ago);
};
