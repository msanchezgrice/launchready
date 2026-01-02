import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
            card: 'shadow-2xl',
          },
        }}
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/sign-up"
      />
    </div>
  )
}
