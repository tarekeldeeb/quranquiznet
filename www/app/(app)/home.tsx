// /home has been merged into /me. Keep this route as a redirect so any
// existing links, deep links, or cached navigations land on the new dashboard.
import { Redirect } from 'expo-router';

export default function HomeRedirect() {
  return <Redirect href="/(app)/me" />;
}
