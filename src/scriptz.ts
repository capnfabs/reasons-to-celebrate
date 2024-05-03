import van from "vanjs-core"

const { b, button, div, h2, table, thead, tbody, input, tr, th, td, p } = van.tags;

const MILLIS_TO_DAYS = 1 / (1000 * 60 * 60 * 24);

const LIST_OF_SIGNIFICANT_DAYCOUNTS = (() => {
  const milestones = [];
  // not so many people live to 121 years == ~44k days
  for (var i = 1; i < 44; i++) {
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

const Table = ({ head, data }: { head: (HTMLElement | string)[], data: (HTMLElement | string)[][] }) => table(
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

async function listConnectionNames() {
  const client = await window.getAuthedGoogleClient();

  let response;
  try {
    // Fetch first 10 files
    response = await client.people.people.connections.list({
      'resourceName': 'people/me',
      'pageSize': 10,
      'personFields': 'names,emailAddresses',
    });
  } catch (err) {
    //document.getElementById('content').innerText = err.message;
    return;
  }
  const connections = response.result.connections;
  if (!connections || connections.length == 0) {
    //document.getElementById('content').innerText = 'No connections found.';
    return;
  }
  // Flatten to string to display
  const output = connections.reduce(
    (str: string, person: any) => {
      if (!person.names || person.names.length === 0) {
        return `${str}Missing display name\n`;
      }
      return `${str}${person.names[0].displayName}\n`;
    },
    'Connections:\n');
  console.log(output);
}

const LargerApp = () => {
  const googleLoaded = van.state(false);
  return div(
    h2("How about your friends?"),
    button({ onclick: () => listConnectionNames() }, "auth Google!"),
  );
};

van.add(document.body, MiniApp());
van.add(document.body, LargerApp());
