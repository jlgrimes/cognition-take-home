import { listUsers } from "@internal/platform/auth";
import { getDb } from "@/lib/db";
import { signIn } from "./actions";

export default function LoginPage() {
  const users = listUsers(getDb());
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-gray-600">
        Mock SSO: pick a persona. In production this is an Entra ID / Okta redirect, and roles come from IdP groups.
      </p>
      <div className="mt-6 grid gap-2">
        {users.map((u) => (
          <form key={u.id} action={signIn}>
            <input type="hidden" name="userId" value={u.id} />
            <button className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-gray-400">
              <span>
                <span className="font-medium">{u.name}</span>
                <span className="ml-2 text-sm text-gray-500">{u.title}</span>
              </span>
              <span className="font-mono text-xs text-gray-500">{u.roles.join(", ")}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
