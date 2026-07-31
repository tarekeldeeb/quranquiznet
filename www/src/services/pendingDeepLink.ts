// Deep links into the authenticated (app) group (e.g. an "add friend" link
// tapped by someone who isn't signed in yet) get bounced to (auth) before
// AddByCodeScreen ever runs. Stash the originally-requested path here so
// (auth)/index.tsx can send the user straight back to it once sign-in
// resolves, instead of always landing on onboarding/me and silently
// dropping the link. In-memory only — this only needs to survive the
// auth redirect within the same app session, never a process restart.
let pendingPath: string | null = null;

export function setPendingDeepLink(path: string) {
  pendingPath = path;
}

export function consumePendingDeepLink(): string | null {
  const path = pendingPath;
  pendingPath = null;
  return path;
}
