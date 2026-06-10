import Image from "next/image";

type Props = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
};

const SIZES = {
  sm: { mark: 24, text: "text-[15px]", gap: "gap-2" },
  md: { mark: 32, text: "text-[17px]", gap: "gap-2.5" },
  lg: { mark: 40, text: "text-[21px]", gap: "gap-3" },
  xl: { mark: 52, text: "text-[28px]", gap: "gap-3" },
};

export function MonexityLogo({ size = "md", className, label = "Monexity" }: Props) {
  const { mark, text, gap } = SIZES[size];
  return (
    <div className={["flex items-center", gap, className].join(" ")}>
      <div className="relative shrink-0" style={{ width: mark, height: mark }}>
        <Image
          src="/logo/monexity-mark-light.svg"
          alt=""
          fill
          sizes={`${mark}px`}
          className="object-contain dark:hidden"
        />
        <Image
          src="/logo/monexity-mark-dark.svg"
          alt=""
          fill
          sizes={`${mark}px`}
          className="hidden object-contain dark:block"
        />
      </div>
      <span
        className={[
          text,
          "font-semibold tracking-[-0.022em] text-slate-900 dark:text-white",
        ].join(" ")}
      >
        {label}
      </span>
    </div>
  );
}
