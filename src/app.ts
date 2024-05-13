import { van } from "./ui/van";
import { Columns, Table, devOnlyStorage } from "./ui/lib";

import { loadGoogleApis } from "./googleNonsenseWrapper";
import { parseVcards } from "./contacts/vcardContacts";
import { loadContactsFromGoogle } from "./contacts/googleContacts";
import { CalendarDate, UserSuppliedContact } from "./contacts/types";
import { MILLIS_TO_DAYS, Milestone, computeMilestones, computeMilestonesForLotsOfPeople } from "./milestones";
import { ValidContact, selectValidContacts } from "./contacts/valid";

const { a, b, button, div, h2, input, p } = van.tags;


import styles from "./styles.module.css"
import { Tabs } from "vanjs-ui";
import { ChildDom } from "vanjs-core";

const MiniApp = () => {
  const birthday = van.state<string>(devOnlyStorage.getItem('birthday') || '');
  const shouldDisplay = van.derive(() => !!birthday.val);
  const daysAgo = van.derive(() => Math.floor((new Date().getTime() - new Date(birthday.val).getTime()) * MILLIS_TO_DAYS));
  const allDates = van.derive(() => computeMilestones(new Date(birthday.val), undefined, undefined, 15));
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
        Table({ head: ["Occasion", "Date"], data: allDates.val.map(({ formattedLabel, date }) => [formattedLabel + " days old", date.toLocaleDateString()]) })
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

const UserSuppliedContactData = (contacts: UserSuppliedContact[]): Element => {
  if (contacts.length) {
    return Table({ head: ["Name", "Birthday", "Parsed"], data: contacts.map((c) => [c.name, c.birthdayRawText, dateWithPlaceholders(c.birthdayParsed)]) });
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

const LargerApp = () => {
  const googleLoaded = van.state(false);
  const rawContacts = van.state<UserSuppliedContact[] | null>(null);
  const allMilestones = van.state<[ValidContact, Milestone][] | null>(null);
  const authedGoogleClient = loadGoogleApis(document).then((a) => { googleLoaded.val = true; return a });

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
      const tabs: {Milestones?: ChildDom, "Imported Contacts (debug)"?: ChildDom} = {};
      if (allMilestones.val) {
        tabs["Milestones"] = MergedMilestonesTable(allMilestones.val);
      }
      if (rawContacts.val) {
        tabs["Imported Contacts (debug)"] = UserSuppliedContactData(rawContacts.val);
      }
      return Tabs({}, tabs);
    },
  );
};

van.add(document.getElementById('appTarget1')!, MiniApp());
van.add(document.getElementById('appTarget2')!, LargerApp());
