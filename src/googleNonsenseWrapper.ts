const CLIENT_ID = "587480390208-mlck7cejl7sgmnnckacml59gfbusanql.apps.googleusercontent.com";
const API_KEY = "AIzaSyA_3qfPUe-0FmaBRRpzCHQHjn1qtDxrxWQ";
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/people/v1/rest';
// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/contacts.readonly';

let googleApiClientInitialized: boolean;
let googleIdentityServicesInitialized: boolean;
let tokenClient: any;

let attemptingAuth: boolean;
let alreadyAuthed: boolean;

let authQueue: [(value: any) => void, (value: any) => void][] = [];

let alreadyAvailable: boolean;
let availableQueue: [() => void, () => void][] = []

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  googleApiClientInitialized = true;
  maybeNotifyGoogleAvailable();
}

/**
       * Enables user interaction after all libraries are loaded.
       */
function maybeNotifyGoogleAvailable() {
  if (googleApiClientInitialized && googleIdentityServicesInitialized) {
    console.log("Google available!");
    alreadyAvailable = true;
    const queue = availableQueue;
    availableQueue = [];
    for (const [resolve,] of queue) {
      resolve();
    }
  }
}

/** Sign out the user upon button click. */
// TODO implement properly
function handleSignout() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
}

const googleApiJsLoaded = () => {
  gapi.load('client', initializeGapiClient);
};

const googleIdentityServicesJsLoaded = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (resp) => {
      attemptingAuth = false;
      if (resp.error) {
        console.log("rejecting");
        const movedQueue = authQueue;
        authQueue = [];
        for (const [, reject] of movedQueue) {
          reject(resp.error);
        }
      } else {
        console.log("resolving");
        const movedQueue = authQueue;
        authQueue = [];
        for (const [resolve] of movedQueue) {
          resolve(gapi.client);
        }
      }
    },
  });
  googleIdentityServicesInitialized = true;
  maybeNotifyGoogleAvailable();
};

// types for the Google Clients are garbage
const getAuthedGoogleClient = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (alreadyAuthed) {
      resolve(gapi.client);
    } else {
      authQueue.push([resolve, reject]);
      // no idea if this should be gated or not based on whether we're already attempting
      attemptAuth();
    }
  });
}

function attemptAuth() {
  attemptingAuth = true;
  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

window.googleApiJsLoaded = googleApiJsLoaded;
window.googleIdentityServicesJsLoaded = googleIdentityServicesJsLoaded;
window.getAuthedGoogleClient = getAuthedGoogleClient;
