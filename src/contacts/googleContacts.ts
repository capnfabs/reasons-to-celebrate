import { AuthenticatedGoogleClient, GoogleApiProvider } from "../googleNonsenseWrapper";
import { filterMap } from "../util";
import { UserSuppliedContact } from "./types";

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

export async function loadContactsFromGoogle(provider: Promise<GoogleApiProvider>): Promise<UserSuppliedContact[]> {
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
