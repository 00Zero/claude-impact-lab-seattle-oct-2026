import Clippy from "@/components/Clippy";
import { loadExample } from "@/lib/example";
import { currentUserEmail } from "@/lib/supabase/server";

// Reads the session cookie at request time.
export const instant = false;

export default async function AppPage() {
  return <Clippy example={loadExample()} email={await currentUserEmail()} />;
}
