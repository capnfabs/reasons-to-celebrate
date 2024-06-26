const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
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
      // '' means "only ask permission the first time"
      prompt: '',
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp: google.accounts.oauth2.TokenResponse) => {
        if (resp.error) {
          const movedQueue = this.authQueue;
          this.authQueue = [];
          for (const [, reject] of movedQueue) {
            reject(resp.error);
          }
        } else {
          const movedQueue = this.authQueue;
          this.authQueue = [];
          for (const [resolve] of movedQueue) {
            resolve(gapi.client);
          }
        }
      },
    });
  }

  public getAuthenticatedClient(): Promise<AuthenticatedGoogleClient> {
    return new Promise((resolve, reject) => {
      if (this.alreadyAuthed) {
        resolve(gapi.client);
      } else {
        this.authQueue.push([resolve, reject]);
        // no idea if this should be gated or not based on whether we're already attempting
        this.tokenClient.requestAccessToken();
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
