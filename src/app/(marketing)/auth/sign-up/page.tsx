import { signUp } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";

type SignUpPageProps = {
  searchParams: Promise<{
    redirectTo?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { redirectTo } = await searchParams;

  return (
    <main className="page-frame flex min-h-screen items-center justify-center py-10">
      <section className="card-surface grid w-full max-w-md gap-6 rounded-[2rem] p-6 md:p-8">
        <div>
          <p className="eyebrow">Account Access</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
            Create an account
          </h1>
          <p className="mt-4 text-sm leading-7 text-ink-soft">
            New accounts default to the `user` role. Promote a profile to curator or
            admin in Supabase to unlock the protected admin routes.
          </p>
        </div>

        <AuthForm mode="sign-up" action={signUp} redirectTo={redirectTo} />
      </section>
    </main>
  );
}