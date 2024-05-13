const van: Van = (await import(import.meta.env.DEV ? 'vanjs-core/debug' : 'vanjs-core')).default;

import { ChildDom, Van } from "vanjs-core";

import { loadGoogleApis } from "./googleNonsenseWrapper";
import { parseVcards } from "./contacts/vcardContacts";
import { loadContactsFromGoogle } from "./contacts/googleContacts";
import { CalendarDate, UserSuppliedContact } from "./contacts/types";
import { MILLIS_TO_DAYS, Milestone, computeMilestones, computeMilestonesForLotsOfPeople } from "./milestones";
import { ValidContact, selectValidContacts } from "./contacts/valid";

const { b, button, div, h2, table, thead, tbody, input, tr, th, td, p } = van.tags;

const Table = ({ head, data }: { head: (ChildDom)[], data: ChildDom[][] }) => table(
  head ? thead(tr(head.map(h => th(h)))) : [],
  tbody(data.map(row => tr(
    row.map(col => td(col)),
  ))),
);

const MiniApp = () => {
  const birthday = van.state<string>(window.localStorage.getItem('birthday') || '');
  const shouldDisplay = van.derive(() => !!birthday.val);
  const daysAgo = van.derive(() => Math.floor((new Date().getTime() - new Date(birthday.val).getTime()) * MILLIS_TO_DAYS));
  const allDates = van.derive(() => computeMilestones(new Date(birthday.val), undefined, undefined, 15));
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
        Table({ head: ["Occasion", "Date"], data: allDates.val.map(({formattedLabel, date}) => [formattedLabel + " days old", date.toLocaleDateString()]) })
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

// TODO: style
const Collapsible = (header: ChildDom, children: ChildDom): Node => {
  const collapsed = van.state(true);
  return div(
    button({
      onclick: () => collapsed.val = !collapsed.val,
    }, header),
    div(
      { style: () => (collapsed.val ? "display: none" : ""), },
      children
    )
  );
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

  return div(
    h2("How about your friends?"),
    // TODO make this error if we can't load Google
    button(
      {
        onclick: async () => {
          const userContacts = await loadContactsFromGoogle(authedGoogleClient);
          rawContacts.val = userContacts;
          const validContacts = selectValidContacts(userContacts);
          allMilestones.val = computeMilestonesForLotsOfPeople(validContacts, (c) => c.birthday);
        },
        disabled: () => !googleLoaded.val,
      }, "Log in with Google"),
    button(
      {
        onclick: async () => {
          const userContacts = await loadContactsFromVcardFile();
          rawContacts.val = userContacts;
          const validContacts = selectValidContacts(userContacts);
          allMilestones.val = computeMilestonesForLotsOfPeople(validContacts, (c) => c.birthday);
        },
      }, "Import from vcf / vcard file"),
    () => rawContacts.val ? Collapsible("Imported data", UserSuppliedContactData(rawContacts.val)) : '',
    () => allMilestones.val ? MergedMilestonesTable(allMilestones.val) : '',
  );
};

van.add(document.body, MiniApp());
van.add(document.body, LargerApp());
