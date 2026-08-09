import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { ProductShell } from "@/components/product-shell";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <ProductShell>
      <LoginForm />
    </ProductShell>
  );
}
