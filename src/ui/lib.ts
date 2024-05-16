import van, { ChildDom } from "vanjs-core";

const { button, div, table, thead, tbody, tr, th, td } = van.tags;

import styles from '../styles.module.css';
import libStyles from "./lib.module.css";

export const Table = ({ head, data }: { head: (ChildDom)[], data: ChildDom[][] }) => table(
  head ? thead(tr(head.map(h => th(h)))) : [],
  tbody(data.map(row => tr(
    row.map(col => td(col)),
  ))),
);

export const devOnlyStorage = {
  setItem: (key: string, value: string): void => {
    if (import.meta.env.DEV) {
      window.localStorage.setItem(key, value);
    }
  },
  getItem: (key: string): string | null => {
    if (import.meta.env.DEV) {
      return window.localStorage.getItem(key);
    }
    return null;
  }
};

export const Collapsible = (header: ChildDom, children: ChildDom): Node => {
  const collapsed = van.state(true);
  return div(
    {class: [libStyles.collapsible, styles.greyBorder].join(' ')},
    button({
      class: () => [libStyles.collapseHeader].concat(collapsed.val ? [libStyles.collapsed] : []).join(' '),
      onclick: () => collapsed.val = !collapsed.val,
    }, header),
    div(
      { style: () => (collapsed.val ? "display: none" : ""), },
      children
    )
  );
}

export const Columns = (...content: ChildDom[]): Node => {
  return div(
    {
      class: libStyles.columns,
    },
    ...content.map((c) => div({class: libStyles.col}, c)),
  )
}

export type Tab = {
  header: ChildDom,
  body: ChildDom,
}

export const LoadingSpinner = (): Node => {
  // from https://loading.io/css/
  return div({class: libStyles.ldsEllipsis}, div(), div(), div(), div(),)
}
