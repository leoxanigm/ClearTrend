// Join optional class names while discarding false, null, and undefined values.
export function cx(...classes: Array<string | false | null | undefined>) {
  // This intentionally handles flat class lists only; no CSS merge logic is needed.
  return classes.filter(Boolean).join(" ");
}
