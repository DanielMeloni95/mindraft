import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Nuova password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Imposta una nuova password
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Poi torni direttamente nel tuo spazio.
      </p>
      <ResetPasswordForm />
    </>
  );
}
