import { signIn } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";

type SignInPageProps = {
  searchParams: Promise<{
    redirectTo?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { redirectTo } = await searchParams;

  return (
    <main className="page-frame flex min-h-screen items-center justify-center py-10">
      <section className="card-surface grid w-full max-w-md gap-6 rounded-[2rem] p-6 md:p-8">
        <div>
          <p className="eyebrow">Account Access</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
            Sign in
          </h1>
          <p className="mt-4 text-sm leading-7 text-ink-soft">
            Use your Supabase account to test admin access and synced trip behavior.
          </p>
        </div>

        <AuthForm mode="sign-in" action={signIn} redirectTo={redirectTo} />
      </section>
    </main>
  );
}