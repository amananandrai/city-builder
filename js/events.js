/** Tiny event bus so the simulation can notify the renderer without importing it. */
const handlers = {};
export const on   = (name, fn) => (handlers[name] ??= []).push(fn);
export const emit = (name, data) => { for (const fn of handlers[name] ?? []) fn(data); };
