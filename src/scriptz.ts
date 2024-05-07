import van, { ChildDom } from "vanjs-core"
import { AuthenticatedGoogleClient, GoogleApiProvider, loadGoogleApis } from "./googleNonsenseWrapper";
import vCard from "vcf";
import { CalendarDate, UserSuppliedContact, extractBirthday, parseVcards } from "./vcardContacts";

type GoogleContact = gapi.client.people.Person;

const { b, button, div, h2, table, thead, tbody, input, tr, th, td, p } = van.tags;

const MILLIS_TO_DAYS = 1 / (1000 * 60 * 60 * 24);

const LIST_OF_SIGNIFICANT_DAYCOUNTS = (() => {
  const milestones = [];
  // not so many people live to 121 years == ~44k days
  for (var i = 1; i < 45; i++) {
    milestones.push(i * 1000);
  }

  // This code should probably:
  // choose 3 from the 1000s
  // add at least one special number from each category if they're possible

  milestones.push(
    1234,
    12345,
    3141,
    31415,
    1111,
    2222,
    3333,
    4444,
    5555,
    6666,
    7777,
    8888,
    9999,
    11111,
    22222,
    33333,
    44444,
  )
  milestones.sort((a, b) => a - b);
  return milestones;
})();

const Table = ({ head, data }: { head: (ChildDom)[], data: ChildDom[][] }) => table(
  head ? thead(tr(head.map(h => th(h)))) : [],
  tbody(data.map(row => tr(
    row.map(col => td(col)),
  ))),
);

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
    }
  }).join("");

  // we might have a leading zero, so force base-10.
  const magicNum = parseInt(runFormatter(numFormat), 10);
  const formatted = runFormatter(format);

  return [formatted, magicNum];
}

const computeDays = (startDate: Date): [number, Date][] => {
  if (!startDate) {
    return [];
  }

  const dayCutoff = (new Date().getTime() - startDate.getTime()) * MILLIS_TO_DAYS;
  var relevantStartIdx = 0;
  for (var i = 0; i < LIST_OF_SIGNIFICANT_DAYCOUNTS.length; i++) {
    if (LIST_OF_SIGNIFICANT_DAYCOUNTS[i] >= dayCutoff) {
      relevantStartIdx = i;
      break;
    }
  }
  if (relevantStartIdx > LIST_OF_SIGNIFICANT_DAYCOUNTS.length) {
    // don't blow past end of the array
    // TODO add better handling for people messing with really really old days
    relevantStartIdx = 0;
  }

  const dayCounts = LIST_OF_SIGNIFICANT_DAYCOUNTS.slice(relevantStartIdx);

  const [, birthdayNum] = buildBirthdayNumber(startDate);
  dayCounts.push(birthdayNum);
  dayCounts.sort((a, b) => a - b);

  return dayCounts.map((days) => [days, addDays(startDate, days)]);
};

const MiniApp = () => {
  const birthday = van.state<string>(window.localStorage.getItem('birthday') || '');
  const shouldDisplay = van.derive(() => !!birthday.val);
  const daysAgo = van.derive(() => Math.floor((new Date().getTime() - new Date(birthday.val).getTime()) * MILLIS_TO_DAYS));
  const allDates = van.derive(() => computeDays(new Date(birthday.val)));
  return div(
    h2("When's your birthday?"),
    p("Please include the year. Don't worry, we won't tell anyone."),
    input({
      type: "date",
      value: birthday,
      oninput: e => {
        birthday.val = e.target.value;
        window.localStorage.setItem('birthday', e.target.value);
      }
    }),
    () => shouldDisplay.val ?
      div(
        p(
          "Nice! You were born ",
          b(daysAgo),
          " days ago today!",
        ),
        p("Maybe you'd like to celebrate these future milestones:"),
        Table({ head: ["Occasion", "Date"], data: allDates.val.map(([day, date]) => [day.toLocaleString() + " days old", date.toLocaleDateString()]).slice(0, 10) })
      ) : "",
  );
}

async function fetchAllContacts(client: AuthenticatedGoogleClient) {
  let response: gapi.client.Response<gapi.client.people.ListConnectionsResponse>;
  let nextPageToken: string | undefined;
  let allContacts = [];
  do {
    response = await client.people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 100,
      personFields: 'names,birthdays',
      pageToken: nextPageToken,
    });

    allContacts.push(...response.result.connections!);
    nextPageToken = response.result.nextPageToken;
  } while (nextPageToken);
  return allContacts;
}

function birthdateValid(birthday: CalendarDate): boolean {
  return !!(birthday.day && birthday.month && birthday.year && birthday.year > 1900);
}

type GroupedContacts = {
  withoutBirthdays: UserSuppliedContact[],
  withInvalidBirthYears: UserSuppliedContact[],
  useable: UserSuppliedContact[],
};

function groupContacts(contacts: UserSuppliedContact[]): GroupedContacts {
  const contactsWithoutBirthdays = [];
  const contactsWithInvalidBirthYears = [];
  const useableContacts = [];

  // Flatten to string to display
  for (const c of contacts) {
    // can't do anything with a contact without names
    if (!c.name) {
      continue;
    }
    // Note that this duplicates code in birthdateValid
    // but it's better diagnostics for the user.
    if (!c.birthdayParsed) {
      contactsWithoutBirthdays.push(c);
      continue;
    }

    if (!birthdateValid(c.birthdayParsed)) {
      contactsWithInvalidBirthYears.push(c);
      continue;
    }

    useableContacts.push(c);
  }

  return {
    withoutBirthdays: contactsWithoutBirthdays,
    withInvalidBirthYears: contactsWithInvalidBirthYears,
    useable: useableContacts,
  };
}

function filterMap<In,Out>(array: In[], func: (val: In) => Out | undefined): Out[] {
  const results: Out[] = [];
  for (const elem of array) {
    const result = func(elem);
    if (result !== undefined) {
      results.push(result);
    }
  }
  return results
}

async function loadContactsFromGoogle(provider: Promise<GoogleApiProvider>): Promise<UserSuppliedContact[]> {
  const p = await provider;
  const client = await p.getAuthenticatedClient();

  const allContacts = await fetchAllContacts(client);
  const remapped: UserSuppliedContact[] = filterMap(allContacts, (gc) => {
    if (!gc.names || gc.names.length === 0 || !gc.names[0].displayName) {
      return undefined;
    }
    let birthday = gc.birthdays && gc.birthdays.length > 0 ? gc.birthdays[0] : undefined;
    return {
      name: gc.names[0].displayName,
      birthdayRawText: birthday?.text,
      birthdayParsed: birthday?.date,
    }
  })
  return remapped;
}

type Contact = {
  id: string,
  displayName: string,
  birthday: Date
}

// function remapContacts(contacts: GoogleContact[]): Contact[] {
//   // We should've validated this elsewhere but do it here too just to be sure.
//   return contacts.filter((c) => (birthdateValid(c))).map((c) => {
//     const birthday = c.birthdays![0].date!;
//     return {
//       id: c.resourceName!,
//       displayName: c.names![0].displayName!,
//       birthday: new Date(birthday.year!, birthday.month! - 1, birthday.day)
//     }
//   });
// }

function dateWithPlaceholders(date?: CalendarDate): string {
  if (!date) {
    return '??';
  }
  const formatter = new Intl.DateTimeFormat().formatToParts();
  return formatter.map((component) => {
    switch (component.type) {
      case "day":
        return date.day?.toString().padStart(2, '0') || '??';
      case "month":
        return date.month?.toString().padStart(2, '0') || '??';
      case "year":
        return date.year?.toString().padStart(4, '0') || '????';
      case "literal":
        return component.value;
    }
  }).join("");
}

const UserSuppliedContactData = (contacts: UserSuppliedContact[]) => {
  return Table({head: ["Name", "Birthday", "Parsed"], data: contacts.map((c) => [c.name, c.birthdayRawText, dateWithPlaceholders(c.birthdayParsed)])});
}

function askUserForFile(): Promise<string> {
  const promise = new Promise((resolve: (val: string) => void, reject: (val:string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vcf,.vcard,text/vcard';

    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const files = target.files!;
      if (files.length < 1) {
        return;
      }
      const file = files[0];
      resolve(await file.text());
    };

    input.oncancel = () => {
      // i have no idea how many l's are in cancelled
      reject('cancelled');
    }

    // let's goo!
    input.click();
  });
  return promise;
}

async function loadContactsFromVcardFile(): Promise<UserSuppliedContact[]> {
  const fileContent = await askUserForFile();
  console.log('loaded file content');
  return parseVcards(fileContent);
};

const LargerApp = () => {
  const googleLoaded = van.state(false);
  const rawContacts = van.state<UserSuppliedContact[] | null>(null);
  const authedGoogleClient = loadGoogleApis(document).then((a) => { googleLoaded.val = true; return a });

  return div(
    h2("How about your friends?"),
    // TODO make this error if we can't load Google
    button(
      {
        onclick: async () => {
          rawContacts.val = await loadContactsFromGoogle(authedGoogleClient);
        },
        disabled: () => !googleLoaded.val,
      }, "Log in with Google"),
      button(
        {
          onclick: async () => {
            rawContacts.val = await loadContactsFromVcardFile();
          },
        }, "Import from vcf / vcard file"),
      () => rawContacts.val ? UserSuppliedContactData(rawContacts.val) : '',
  );
};

van.add(document.body, MiniApp());
van.add(document.body, LargerApp());


/*

  if (remapped.length == 0) {
    console.log('no contacts!?');
  }

  const groupedContacts = groupContacts(remapped);
  const total = groupedContacts.useable.length + groupedContacts.withInvalidBirthYears.length + groupedContacts.withoutBirthdays.length;

  console.log(`Imported ${total} contacts, of which ${groupedContacts.useable.length} are useable`);

  return groupedContacts;
 */
