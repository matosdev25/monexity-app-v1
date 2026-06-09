import { logout } from "../app/auth/logout/actions";

type IconProps = {
  className?: string;
};

function LogoutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 6.75H8.25C7.01 6.75 6 7.76 6 9V15C6 16.24 7.01 17.25 8.25 17.25H10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M13 8L17 12L13 16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 12H9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoutButton() {
  return (
    <form action={logout} className="w-full">
      <button
        type="submit"
        className={[
          "group flex w-full items-center gap-3 rounded-[22px] px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.98] active:opacity-90",
          "border border-transparent text-rose-500/90 hover:bg-rose-500/8 hover:text-rose-600",
          "dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
            "bg-rose-500/8 text-rose-500/90 group-hover:bg-rose-500/12 group-hover:text-rose-600",
            "dark:bg-rose-500/10 dark:text-rose-300 dark:group-hover:bg-rose-500/14 dark:group-hover:text-rose-200",
          ].join(" ")}
        >
          <LogoutIcon className="h-[18px] w-[18px]" />
        </span>

        <span className="truncate text-[15px] font-medium tracking-tight">
          Cerrar sesión
        </span>
      </button>
    </form>
  );
}
