import van, { ChildDom } from "vanjs-core"
import { AuthenticatedGoogleClient, GoogleApiProvider, loadGoogleApis } from "./googleNonsenseWrapper";

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

const buildBirthdayNumber = (date: Date, locale: string | undefined): [string, number] => {
  const format = new Intl.DateTimeFormat(locale).formatToParts(date);
  const numFormat = format.filter((x) => x.type !== "literal");
  const shouldPadDayAndMonthFields = numFormat.map((x) => x.value)[0].length === 1;

  const magicNum = parseInt(numFormat.map((component, idx) => {
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
  }).join(""), 10);

  const formatted = format.map((component) => {
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
      default:
        return component.value;
    }
  }).join("");
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

  // TODO build really weird day, e.g.
  // for 1989-07-17 -> 17789 (for en-AU), 71789 (for en-US)
  // where it gets complex is if _both_ the day and month are < 10 and it compresses to a 4-digit number, then add a 0 to the middle number (or to both, to make it look consistent, eg 1990-2-7 -> 070290 (display) = 70290 (calc) OR 020790 (display, US) = 20790 (calc, US))


  return LIST_OF_SIGNIFICANT_DAYCOUNTS.slice(relevantStartIdx).map((days) => [days, addDays(startDate, days)]);
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

function birthdateValid(contact: GoogleContact): boolean {
  if (!contact.birthdays || contact.birthdays.length === 0) {
    return false;
  }
  const birthday = contact.birthdays[0];
  if (!birthday.date) {
    return false;
  }
  return !!(birthday.date.day && birthday.date.month && birthday.date.year && birthday.date.year > 1900);
}

type GroupedContacts = {
  withoutBirthdays: GoogleContact[],
  withInvalidBirthYears: GoogleContact[],
  useable: GoogleContact[],
};

function groupContacts(contacts: GoogleContact[]): GroupedContacts {
  const contactsWithoutBirthdays = [];
  const contactsWithInvalidBirthYears = [];
  const useableContacts = [];

  // Flatten to string to display
  for (const c of contacts) {
    // can't do anything with a contact without names
    if (!c.names || c.names.length == 0) {
      continue;
    }
    // Note that this duplicates code in birthdateValid
    // but it's better diagnostics for the user.
    if (!c.birthdays || c.birthdays.length == 0) {
      contactsWithoutBirthdays.push(c);
      continue;
    }

    if (!birthdateValid(c)) {
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

async function loadAllContacts(provider: Promise<GoogleApiProvider>): Promise<GroupedContacts> {
  const p = await provider;
  const client = await p.getAuthenticatedClient();

  const allContacts = await fetchAllContacts(client);

  if (allContacts.length == 0) {
    console.log('no contacts!?');
  }

  const groupedContacts = groupContacts(allContacts);
  const total = groupedContacts.useable.length + groupedContacts.withInvalidBirthYears.length + groupedContacts.withoutBirthdays.length;

  console.log(`Imported ${total} contacts, of which ${groupedContacts.useable.length} are useable`);

  return groupedContacts;
}

type Contact = {
  id: string,
  displayName: string,
  birthday: Date
}

function remapContacts(contacts: GoogleContact[]): Contact[] {
  // We should've validated this elsewhere but do it here too just to be sure.
  return contacts.filter((c) => (birthdateValid(c))).map((c) => {
    const birthday = c.birthdays![0].date!;
    return {
      id: c.resourceName!,
      displayName: c.names![0].displayName!,
      birthday: new Date(birthday.year!, birthday.month! - 1, birthday.day)
    }
  });
}

const ContactData = (contacts: Contact[]) => {
  // TODO: this is raw data and should take a different type so that it accommodates incorrect birthdays and can display those
  return Table({head: ["Name", "Birthday"], data: contacts.map((c) => [c.displayName, c.birthday.toLocaleDateString()])});
}

const LargerApp = () => {
  const googleLoaded = van.state(false);
  const contacts = van.state<Contact[] | null>(null);
  const authedGoogleClient = loadGoogleApis(document).then((a) => { googleLoaded.val = true; return a });

  return div(
    h2("How about your friends?"),
    // TODO make this error if we can't load Google
    button(
      {
        onclick: async () => {
          const grouped = await loadAllContacts(authedGoogleClient);
          contacts.val = remapContacts(grouped.useable);
        },
        disabled: () => !googleLoaded.val,
      }, "Log in with Google"),
      () => contacts.val ? ContactData(contacts.val) : '',
  );
};

van.add(document.body, MiniApp());
van.add(document.body, LargerApp());
