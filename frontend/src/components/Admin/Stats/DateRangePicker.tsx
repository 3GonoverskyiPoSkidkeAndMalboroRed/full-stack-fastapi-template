import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type DateRangeValue = { from: Date; to: Date }

export type RangePreset = {
  key: string
  label: string
  range: () => DateRangeValue
}

type DateRangePickerProps = {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  presets?: RangePreset[]
  /** Если задан — ограничиваем выбор произвольного диапазона в днях. */
  maxRangeDays?: number
  className?: string
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function formatRange(range: DateRangeValue): string {
  if (isSameDay(range.from, range.to)) {
    return format(range.from, "d MMMM yyyy", { locale: ru })
  }
  return `${format(range.from, "d MMM", { locale: ru })} — ${format(
    range.to,
    "d MMM yyyy",
    { locale: ru },
  )}`
}

export function DateRangePicker({
  value,
  onChange,
  presets = [],
  maxRangeDays,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: value.from,
    to: value.to,
  })
  const [error, setError] = useState<string | null>(null)

  function handlePreset(preset: RangePreset) {
    const next = preset.range()
    setError(null)
    setDraft({ from: next.from, to: next.to })
    onChange(next)
    setOpen(false)
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    setDraft(range)
    if (!range?.from || !range.to) {
      setError(null)
      return
    }
    if (maxRangeDays && diffDays(range.from, range.to) + 1 > maxRangeDays) {
      setError(`Не более ${maxRangeDays} дней`)
      return
    }
    setError(null)
    onChange({ from: range.from, to: range.to })
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft({ from: value.from, to: value.to })
          setError(null)
        }
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "border-ink h-9 rounded-none px-3 font-normal",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {formatRange(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="border-ink w-auto rounded-none p-0"
      >
        <div className="flex flex-col sm:flex-row">
          {presets.length > 0 && (
            <div className="border-ink flex flex-col gap-1 border-b p-2 sm:w-44 sm:border-r sm:border-b-0">
              {presets.map((preset) => (
                <Button
                  key={preset.key}
                  variant="ghost"
                  className="justify-start rounded-none text-[12px] tracking-[0.05em]"
                  onClick={() => handlePreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          <div className="p-2">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={value.from}
              selected={draft}
              onSelect={handleCalendarSelect}
              disabled={{ after: new Date() }}
              locale={ru}
              weekStartsOn={1}
            />
            {error && (
              <p className="text-destructive px-2 pb-2 text-xs">{error}</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
