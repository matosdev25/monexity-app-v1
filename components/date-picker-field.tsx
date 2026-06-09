"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "lucide-react";

type DatePickerFieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
};

type PopoverPosition = {
  top: number;
  left: number;
  width: number;
  fixed: boolean;
};

export function DatePickerField({
  id,
  name,
  label,
  defaultValue,
  required,
}: DatePickerFieldProps) {
  const initialDate = useMemo(() => {
    if (!defaultValue) return new Date();
    return parseISO(defaultValue);
  }, [defaultValue]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(initialDate);
  const [month, setMonth] = useState<Date>(initialDate);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<PopoverPosition>({
    top: 0,
    left: 0,
    width: 320,
    fixed: true,
  });

  useEffect(() => {
    function updatePosition() {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const nearestDialog = buttonRef.current.closest("dialog") as HTMLElement | null;
      const calendarWidth = 320;
      const estimatedHeight = 430;

      if (nearestDialog) {
        const dialogRect = nearestDialog.getBoundingClientRect();
        const innerPadding = 16;

        let left = rect.left - dialogRect.left;
        if (left + calendarWidth > dialogRect.width - innerPadding) {
          left = dialogRect.width - calendarWidth - innerPadding;
        }
        if (left < innerPadding) {
          left = innerPadding;
        }

        const topInDialog = rect.top - dialogRect.top;
        const bottomInDialog = rect.bottom - dialogRect.top;

        const spaceAbove = topInDialog - innerPadding;
        const spaceBelow = dialogRect.height - bottomInDialog - innerPadding;

        const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

        let top = openUpwards
          ? topInDialog - estimatedHeight - 10
          : bottomInDialog + 10;

        const maxTop = dialogRect.height - estimatedHeight - innerPadding;
        top = Math.max(innerPadding, Math.min(top, maxTop));

        setPortalTarget(nearestDialog);
        setPosition({
          top,
          left,
          width: calendarWidth,
          fixed: false,
        });

        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = rect.left;
      if (left + calendarWidth > viewportWidth - 16) {
        left = viewportWidth - calendarWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }

      const spaceBelow = viewportHeight - rect.bottom;
      const openUpwards = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

      setPortalTarget(document.body);
      setPosition({
        top: openUpwards ? rect.top - estimatedHeight - 10 : rect.bottom + 10,
        left,
        width: calendarWidth,
        fixed: true,
      });
    }

    if (open) {
      updatePosition();
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const calendarRoot = document.getElementById(`datepicker-popover-${id}`);

      const clickedInsideField = wrapperRef.current?.contains(target);
      const clickedInsidePopover = calendarRoot?.contains(target);

      if (!clickedInsideField && !clickedInsidePopover) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleWindowChange() {
      if (open) updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open, id]);

  const isoValue = selected ? format(selected, "yyyy-MM-dd") : "";
  const displayValue = selected ? format(selected, "dd/MM/yyyy") : "Selecciona fecha";

  const popover = open ? (
    <div
      id={`datepicker-popover-${id}`}
      className={`z-[9999] rounded-[24px] border border-app bg-app-panel p-4 text-app shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:shadow-[0_20px_50px_rgba(2,6,23,0.42)] ${
        position.fixed ? "fixed" : "absolute"
      }`}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
      }}
    >
      <DayPicker
        mode="single"
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={(date) => {
          if (!date) return;
          setSelected(date);
          setMonth(date);
          setOpen(false);
        }}
        locale={es}
        showOutsideDays
        className="w-full"
        classNames={{
          root: "w-full",
          months: "flex w-full",
          month: "w-full space-y-4",
          caption: "relative flex items-center justify-center pt-1",
          caption_label: "text-sm font-semibold capitalize text-app",
          nav: "flex items-center gap-1",
          button_previous:
            "absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-app bg-app-soft text-app-muted transition hover:text-app",
          button_next:
            "absolute right-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-app bg-app-soft text-app-muted transition hover:text-app",
          month_grid: "w-full border-collapse",
          weekdays: "mt-4 grid grid-cols-7",
          weekday: "text-center text-xs font-medium lowercase text-app-soft",
          week: "mt-2 grid grid-cols-7",
          day: "flex items-center justify-center",
          day_button:
            "flex h-10 w-10 items-center justify-center rounded-xl text-sm text-app transition hover:bg-app-soft",
          today: "font-semibold text-sky-600 dark:text-cyan-300",
          selected:
            "rounded-xl bg-slate-950 text-white hover:bg-slate-950 dark:bg-white dark:text-slate-950 dark:hover:bg-white",
          outside: "text-app-soft opacity-60",
          disabled: "text-app-soft opacity-40",
          hidden: "invisible",
        }}
      />

      <div className="mt-3 flex items-center justify-between border-t border-app pt-3">
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            setSelected(today);
            setMonth(today);
            setOpen(false);
          }}
          className="text-sm font-medium text-sky-600 transition hover:text-sky-700 dark:text-cyan-300 dark:hover:text-cyan-200"
        >
          Hoy
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-app-muted transition hover:text-app"
        >
          Cerrar
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-app-soft">
        {label}
      </label>

      <input type="hidden" name={name} value={isoValue} required={required} />

      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-app bg-app-soft px-4 py-2.5 text-left text-app transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-sky-100/80 dark:focus:ring-cyan-200/10"
      >
        <span>{displayValue}</span>
        <Calendar className="h-5 w-5 text-app-soft" />
      </button>

      {open && portalTarget ? createPortal(popover, portalTarget) : null}
    </div>
  );
}
