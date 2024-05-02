import van from "./van-1.5.0.min.js"

const { a, b, div, h1, h2, table, thead, tbody, input, tr, th, td, li, p, ul } = van.tags;

const MILLIS_TO_DAYS = 1 / (1000 * 60 * 60 * 24);

const Table = ({ head, data }) => table(
    head ? thead(tr(head.map(h => th(h)))) : [],
    tbody(data.map(row => tr(
        row.map(col => td(col)),
    ))),
);

const MiniApp = () => {
    const birthday = van.state();
    const shouldDisplay = van.derive(() => !!birthday.val);
    const daysAgo = van.derive(() => Math.floor((new Date() - new Date(birthday.val)) * MILLIS_TO_DAYS));
    console.log(birthday.value);
    return div(
        h2("When's your birthday?"),
        p("Please include the year. Don't worry, we won't tell anyone."),
        input({
            type: "date",
            value: birthday,
            oninput: e => {
                birthday.val = e.target.value;
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
                Table({ head: ["Occasion", "Date"], data: [["a", "b"]] })
            ) : "",
    );
}

van.add(document.body, MiniApp());
