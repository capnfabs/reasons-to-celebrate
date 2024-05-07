import vCard from "vcf";

export const extractBirthday = (bday: vCard.Property | vCard.Property[] | undefined): {year?: string, month?: string, day?: string} | null => {
  // should add some tests for this
  // Some details about acceptable formats:
  // - https://github.com/nextcloud/contacts/issues/122
  // (links to spec from there, the format is different for vcard 3 and vcard 4)
  // GOODNESS this is complex, these are all technically valid
  // 19960415
  // --0415
  // 19531015T231000Z
  if (bday === undefined) {
    return null;
  }

  // return the first valid
  if (Array.isArray(bday)) {
    for (const item of bday) {
      const result = extractBirthday(item);
      if (result) {
        return result;
      }
    }
    return null;
  }

  //
  const bdayRegexes = [
    // no dashes in between
    // TODO check if the | T thing works
    /^(?<year>\d{2}|\d{4}|--)(?<month>[0-9]{2}|--)(?<day>[0-9]{2}|--)($|T)/,
    /^(?<year>\d{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})($|T)/,
  ]

  const reformatBdayElement = (element: string, omitIfMatch?: string): string | undefined => {
    if (element == '--') {
      return undefined;
    }
    if (element == omitIfMatch) {
      return undefined;
    }
    return element;
  }

  const bdayText = bday.valueOf() as string;
  // @ts-expect-error the xAppleOmitYear is there if it's in the card
  const omitYear: string | undefined = bday['xAppleOmitYear'];
  for (const regex of bdayRegexes) {
    const match = regex.exec(bdayText);
    if (match) {
      return {
        'year': reformatBdayElement(match.groups!['year'], omitYear),
        'month': reformatBdayElement(match.groups!['month']),
        'day': reformatBdayElement(match.groups!['day']),
      }
    }
  }
  // couldn't parse
  return null;
}

