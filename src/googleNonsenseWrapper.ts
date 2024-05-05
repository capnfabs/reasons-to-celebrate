const CLIENT_ID = "587480390208-mlck7cejl7sgmnnckacml59gfbusanql.apps.googleusercontent.com";
const API_KEY = "AIzaSyA_3qfPUe-0FmaBRRpzCHQHjn1qtDxrxWQ";
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/people/v1/rest';
// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/contacts.readonly';

let googleApiClientInitialized: boolean;
let googleIdentityServicesInitialized: boolean;
let availableQueue: [(value: GoogleApiProvider) => void, () => void][] = []

/**
 * Enables use after all libraries are loaded.
 */
function maybeNotifyGoogleAvailable() {
  if (googleApiClientInitialized && googleIdentityServicesInitialized) {
    console.log("Google available!");
    apiProvider = new GoogleApiProvider();

    const queue = availableQueue;
    availableQueue = [];
    for (const [resolve,] of queue) {
      resolve(apiProvider);
    }
  }
}

const googleApiJsLoaded = () => {
  gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
      googleApiClientInitialized = true;
      maybeNotifyGoogleAvailable();
  });
};

const googleIdentityServicesJsLoaded = () => {
  googleIdentityServicesInitialized = true;
  maybeNotifyGoogleAvailable();
};

let googleApiScriptElement: HTMLScriptElement | undefined;
let googleIdentityScriptElement: HTMLScriptElement | undefined;

export type AuthenticatedGoogleClient = typeof gapi.client;

export class GoogleApiProvider {
  private alreadyAuthed: boolean = false;
  private authQueue: [(value: AuthenticatedGoogleClient) => void, (error: string) => void][] = [];
  private tokenClient: google.accounts.oauth2.TokenClient;

  constructor() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp: google.accounts.oauth2.TokenResponse) => {
        if (resp.error) {
          console.log("rejecting");
          const movedQueue = this.authQueue;
          this.authQueue = [];
          for (const [, reject] of movedQueue) {
            reject(resp.error);
          }
        } else {
          console.log("resolving");
          const movedQueue = this.authQueue;
          this.authQueue = [];
          for (const [resolve] of movedQueue) {
            resolve(gapi.client);
          }
        }
      },
    });
  }

  private attemptAuth() {
    if (gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      this.tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  public getAuthenticatedClient(): Promise<AuthenticatedGoogleClient> {
    return new Promise((resolve, reject) => {
      if (this.alreadyAuthed) {
        resolve(gapi.client);
      } else {
        this.authQueue.push([resolve, reject]);
        // no idea if this should be gated or not based on whether we're already attempting
        this.attemptAuth();
      }
    });
  }

  // Sign out the user
  public logOut() {
    const token = gapi.client.getToken();
    if (token !== null) {
      // don't care about result
      google.accounts.oauth2.revoke(token.access_token, () => {});
      gapi.client.setToken(null);
    }
  }
}

let apiProvider: GoogleApiProvider | undefined;

export const loadGoogleApis = (document: Document): Promise<GoogleApiProvider> => {
  if (!googleApiScriptElement) {
    googleApiScriptElement = document.createElement('script');
    googleApiScriptElement.setAttribute('src', 'https://apis.google.com/js/api.js');
    googleApiScriptElement.async = true;
    // probably unnecessary
    googleApiScriptElement.defer = true;
    googleApiScriptElement.onload = googleApiJsLoaded;

    document.body.appendChild(googleApiScriptElement);
  }

  if (!googleIdentityScriptElement) {
    googleIdentityScriptElement = document.createElement('script');
    googleIdentityScriptElement.setAttribute('src', 'https://accounts.google.com/gsi/client');
    googleIdentityScriptElement.async = true;
    // probably unnecessary
    googleIdentityScriptElement.defer = true;
    googleIdentityScriptElement.onload = googleIdentityServicesJsLoaded;

    document.body.appendChild(googleIdentityScriptElement);
  }

  return new Promise((resolve, reject) => {
    if (apiProvider) {
      resolve(apiProvider);
    } else {
      availableQueue.push([resolve, reject]);
    }
  });
}
