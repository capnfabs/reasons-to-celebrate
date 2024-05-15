import { van } from "./ui/van";
import { Columns, Table, devOnlyStorage } from "./ui/lib";

import { loadGoogleApis } from "./googleNonsenseWrapper";
import { parseVcards } from "./contacts/vcardContacts";
import { loadContactsFromGoogle } from "./contacts/googleContacts";
import { CalendarDate, UserSuppliedContact } from "./contacts/types";
import { Milestone, computeMilestones, computeMilestonesForLotsOfPeople } from "./milestones";
import { ValidContact, selectValidContacts } from "./contacts/valid";

const { a, b, button, div, h2, h3, input, p, span } = van.tags;


import styles from "./styles.module.css"
import { ChildDom } from "vanjs-core";
import { SafeDate } from "./datemath";

const expired = (elem: ChildDom): ChildDom => {
  return span({class: styles.strikethrough}, elem);
}
const greyed = (elem: ChildDom): ChildDom => {
  return span({class: styles.greyed}, elem);
}

function getRelativeLabel(date: SafeDate): ChildDom | undefined {
  const today = SafeDate.today();
  if (SafeDate.equals(date, today.addDays(-1))) {
    return greyed(" (yesterday!)");
  } else if (SafeDate.equals(date, today)) {
    return " (today! 🥳)";
  } else if (SafeDate.equals(date, today.addDays(1))) {
    return " (tomorrow!)";
  }

  const numDays = SafeDate.daysBetween(date, today);
  if (numDays > 0 && numDays < 7) {
    return " (less than a week away!)";
  }
}

const MiniApp = () => {
  const birthday = van.state<string>(devOnlyStorage.getItem('birthday') || '');
  const shouldDisplay = van.derive(() => !!birthday.val);
  const daysAgo = van.derive(() => Math.floor(SafeDate.daysBetween(SafeDate.today(), SafeDate.fromString(birthday.val))));
  const allDates = van.derive(() => computeMilestones(SafeDate.fromString(birthday.val), undefined, undefined, 15));
  const currentDate = SafeDate.today();
  return div(
    h2("When's your birthday?"),
    p("Please include the year. Don't worry, we won't tell anyone."),
    input({
      type: "date",
      value: birthday,
      class: styles.greyBorder,
      oninput: e => {
        birthday.val = e.target.value;
        devOnlyStorage.setItem('birthday', e.target.value);
      }
    }),
    () => shouldDisplay.val ?
      div(
        p(
          "Nice! You were born ",
          b(daysAgo.val.toLocaleString()),
          " days ago today! 🥳",
        ),
        p("Maybe you'd like to celebrate these future milestones:"),
        Table({
          head: ["Occasion", "Date"],
          data: allDates.val.map(({ formattedLabel, date }) => {
            const modifier = SafeDate.daysBetween(date, currentDate) < 0 ? expired : (a: ChildDom) => a;
            const label = getRelativeLabel(date);
            return [modifier(formattedLabel + " days old"), [modifier(date.toLocaleDateString()), label]]})
          })
      ) : "",
  );
}

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

function groupAndFilterUserSuppliedContacts(contacts: UserSuppliedContact[]): { contactsWithSomeBirthday: UserSuppliedContact[], countContactsWithoutBirthday: number } {
  const contactsWithSomeBirthday = [];
  let countContactsWithoutBirthday = 0;
  for (const contact of contacts) {
    if (contact.birthdayParsed || contact.birthdayRawText) {
      contactsWithSomeBirthday.push(contact);
    } else {
      countContactsWithoutBirthday++;
    }
  }
  return { contactsWithSomeBirthday, countContactsWithoutBirthday };
}

const UserSuppliedContactData = (contacts: UserSuppliedContact[]): Element => {
  if (contacts.length) {
    const { contactsWithSomeBirthday, countContactsWithoutBirthday } = groupAndFilterUserSuppliedContacts(contacts);
    return div(
      p({ class: styles.disclaimer }, `Your contacts' birthdays need to have a year to be useable in this app, and we automatically filter out contacts born before 1900.`),
      countContactsWithoutBirthday ? p({ class: styles.disclaimer }, `Skipping ${countContactsWithoutBirthday.toLocaleString()} contacts which don't have birthdays.`) : '',
      Table({ head: ["Name", "Birthday", "Parsed"], data: contactsWithSomeBirthday.map((c) => [c.name, c.birthdayRawText, dateWithPlaceholders(c.birthdayParsed)]) })
    );
  } else {
    return div("Couldn't find any contacts 🤔");
  }
}

function askUserForFile(): Promise<string> {
  const promise = new Promise((resolve: (val: string) => void, reject: (val: string) => void) => {
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

const MergedMilestonesTable = (milestones: [ValidContact, Milestone][]) => {
  return Table({
    head: ['Person', 'Occasion', 'Date'],
    data: milestones.map(([p, m]) => [p.name, m.formattedLabel + " days old", m.date.toLocaleDateString()]),
  });
};

const TitleWithSmolLinkOnRight = (kwargs: {title: string, smolLink: ChildDom}): ChildDom => {
  const {title, smolLink} = kwargs;
  return div(
    {style: "display: flex; align-items: baseline;"},
    h3({
      style: "flex-grow: 1",
    }, title),
    div({class: styles.disclaimer}, smolLink),
  );
}

const LargerApp = () => {
  const googleLoaded = van.state(false);
  const rawContacts = van.state<UserSuppliedContact[] | null>(null);
  const allMilestones = van.state<[ValidContact, Milestone][] | null>(null);
  const authedGoogleClient = loadGoogleApis(document).then((a) => { googleLoaded.val = true; return a });
  const debugView = van.state(false);

  const loadContacts = async (loader: Promise<UserSuppliedContact[]>) => {
    const userContacts = await loader;
    rawContacts.val = userContacts;
    const validContacts = selectValidContacts(userContacts);
    allMilestones.val = computeMilestonesForLotsOfPeople(validContacts, (c) => c.birthday);
  };

  return div(
    h2("How about your friends?"),
    p({ class: styles.disclaimer }, "(", a({ href: './how-to-import.html' }, "How to import"), " | ", a({ href: "./privacy.html" }, "All data stays in your browser"), ")"),
    Columns(
      // TODO make this error if we can't load Google
      button(
        {
          class: [styles.goodButton].join(' '),
          onclick: async () => {
            loadContacts(loadContactsFromGoogle(authedGoogleClient));
          },
          disabled: () => !googleLoaded.val,
        }, "Log in with Google"),
      button(
        {
          class: [styles.goodButton].join(' '),
          onclick: async () => {
            loadContacts(loadContactsFromVcardFile());
          },
        }, "Import from vcf / vcard file"),
    ),
    () => {
      // should both be set at the same time
      if (!(allMilestones.val && rawContacts.val)) {
        console.log('early exit');
        return '';
      }

      const milestonesView = div(
        TitleWithSmolLinkOnRight({
          title: 'Milestones',
          smolLink: a(
            {onclick: () => debugView.val = true},
            'Show imported contacts (for debugging)'
          )
        }),
        MergedMilestonesTable(allMilestones.val),
      );
      const importedContactsView = div(
        TitleWithSmolLinkOnRight({
          title: 'Imported Contacts (debug)',
          smolLink: a({onclick: () => debugView.val = false}, 'Show milestones')
        }),
        UserSuppliedContactData(rawContacts.val),
      );

      return debugView.val ? importedContactsView : milestonesView;
    },
  );
};

van.add(document.getElementById('appTarget1')!, MiniApp());
van.add(document.getElementById('appTarget2')!, LargerApp());
