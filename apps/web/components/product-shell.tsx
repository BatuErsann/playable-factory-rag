import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";

type ProductShellProps = {
  children: ReactNode;
  eyebrow?: string;
};

export function ProductShell({ children }: ProductShellProps) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#0c1a33] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_69%_46%,rgba(55,91,145,0.28),transparent_25%),radial-gradient(circle_at_26%_48%,rgba(55,75,112,0.2),transparent_27%)]" />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1210px] items-center gap-12 px-6 py-12 md:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:py-16">
        <section className="select-none lg:pb-2">
          <div className="text-[clamp(4rem,7.2vw,7.25rem)] font-extrabold leading-[1.02] tracking-[-0.055em]">
            <p className="text-[#2a3a59] drop-shadow-[0_14px_34px_rgba(45,69,108,0.16)]">
              Create
            </p>
            <p className="mt-5 bg-gradient-to-r from-[#654b4b] via-[#4d414b] to-[#342f42] bg-clip-text text-transparent drop-shadow-[0_14px_34px_rgba(103,70,63,0.16)]">
              Powerful
            </p>
            <p className="mt-5 text-[#293a58] drop-shadow-[0_14px_34px_rgba(45,69,108,0.16)]">
              Ads
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[410px] lg:mx-0 lg:justify-self-end">
          <div className="mb-11">
            <BrandMark />
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
