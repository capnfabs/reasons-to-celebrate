import { Van } from "vanjs-core";

export const van: Van = (await import(import.meta.env.DEV ? 'vanjs-core/debug' : 'vanjs-core')).default;
