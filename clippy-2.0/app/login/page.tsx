import LoginForm from "./LoginForm";

// Reads the query string at request time.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { mode } = await searchParams;
  return <LoginForm initialMode={mode === "signup" ? "signup" : "login"} />;
}
