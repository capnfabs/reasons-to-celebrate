import vCard from "vcf";
import { CalendarDate, UserSuppliedContact } from "./types";

// returns the text + a parse attempt. The text is for debugging or whatever
export const extractBirthday = (bday: vCard.Property | vCard.Property[] | undefined): [string?, CalendarDate?] => {
  // Some details about acceptable formats:
  // - https://github.com/nextcloud/contacts/issues/122
  // (there's a link to spec from there, the format is different for vcard 3 and vcard 4)
  if (bday === undefined) {
    return [undefined, undefined];
  }

  // Should only have one birthday (according to spec
  // https://datatracker.ietf.org/doc/html/rfc6350#section-6.2.5)
  // but handle gracefully anyway by choosing first valid if there are multiple
  if (Array.isArray(bday)) {
    for (const item of bday) {
      const result = extractBirthday(item);
      if (result) {
        return result;
      }
    }
    return [bday.toString(), undefined];
  }

  //
  const bdayRegexes = [
    // no dashes in between, dashes used for "unknown value"
    /^(?<year>\d{2}|\d{4}|--)(?<month>[0-9]{2}|--)(?<day>[0-9]{2}|--)($|T)/,
    // version with dashes
    /^(?<year>\d{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})($|T)/,
  ]

  const reformatBdayElement = (element: string, omitIfMatch?: string): number | undefined => {
    if (element == '--') {
      return undefined;
    }
    if (element == omitIfMatch) {
      return undefined;
    }
    return parseInt(element, 10);
  }

  const bdayText = bday.valueOf() as string;
  // @ts-expect-error the xAppleOmitYear is there if it's in the card
  const omitYear: string | undefined = bday['xAppleOmitYear'];
  for (const regex of bdayRegexes) {
    const match = regex.exec(bdayText);
    if (match) {
      const parsed = {
        'year': reformatBdayElement(match.groups!['year'], omitYear),
        'month': reformatBdayElement(match.groups!['month']),
        'day': reformatBdayElement(match.groups!['day']),
      }
      return [bdayText, parsed];
    }
  }
  // couldn't parse
  return [bdayText, undefined];
}

function assembleNameFromNProp(nPropContent: string): string | undefined {
  if (!nPropContent) {
    return undefined;
  }
  const components = nPropContent.split(';');
  if (components.length != 5) {
    // invalid format
    return;
  }
  const [family,given,additional] = components;
  const resolved = [given, additional, family].flatMap((n) => n.split(',')).join(' ');
  if (!resolved) {
    return undefined;
  }
}

function chooseName(card: vCard): string | undefined {
  const formattedNameProps = card.get('fn');
  // could be >1 of these
  if (Array.isArray(formattedNameProps)) {
    for (const name of formattedNameProps) {
      if (!name.isEmpty()) {
        return name.valueOf();
      }
    }
  } else if (formattedNameProps) {
    if (!formattedNameProps.isEmpty()) {
      return formattedNameProps.valueOf();
    }
  }
  // there should be at most one of these
  const nameProps = card.get('n');
  if (Array.isArray(nameProps)) {
    for (const name of nameProps) {
      const displayName = assembleNameFromNProp(name.valueOf());
      if (displayName) {
        return displayName;
      }
    }
    // no valid name
    return undefined;
  } else if (nameProps) {
    return assembleNameFromNProp(nameProps.valueOf());
  }
  // no good options
  return undefined;
}

export function parseVcards(fileContent: string): UserSuppliedContact[] {
  let vcards = vCard.parse(fileContent);
  const contacts: UserSuppliedContact[] = [];
  for (const card of vcards) {
    const name = chooseName(card);
    if (!name) {
      continue;
    }
    const [bdayText, bday] = extractBirthday(card.get('bday'));
    contacts.push({
      name,
      birthdayRawText: bdayText,
      birthdayParsed: bday,
    });
  }
  return contacts;
}
