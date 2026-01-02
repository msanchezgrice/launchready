import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
      <SignUp
        appearance={{
          elements: {
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
            card: 'shadow-2xl',
          },
        }}
        fallbackRedirectUrl="/dashboard"
        signInUrl="/sign-in"
      />
    </div>
  )
}
