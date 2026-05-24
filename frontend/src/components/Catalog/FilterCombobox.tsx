import { Check, ChevronsUpDown, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface FilterOption {
  id: string
  name: string
  count?: number
}

interface FilterComboboxProps {
  label: string
  options: FilterOption[]
  value?: string
  onChange: (id: string | undefined) => void
  allLabel?: string
  searchPlaceholder?: string
}

export function FilterCombobox({
  label,
  options,
  value,
  onChange,
  allLabel = "Все",
  searchPlaceholder = "Поиск…",
}: FilterComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value)

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, search])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const select = (id: string | undefined) => {
    onChange(id)
    setOpen(false)
    setSearch("")
  }

  return (
    <div className="relative w-full sm:w-56" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-[11px] tracking-[0.12em] uppercase">
            {label}
          </span>
          <span className="truncate">{selected?.name ?? allLabel}</span>
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 w-full rounded-md border shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            <button
              type="button"
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                "hover:bg-accent hover:text-accent-foreground",
              )}
              onClick={() => select(undefined)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  !value ? "opacity-100" : "opacity-0",
                )}
              />
              {allLabel}
            </button>
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => select(o.id === value ? undefined : o.id)}
              >
                <span className="flex min-w-0 items-center">
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === o.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{o.name}</span>
                </span>
                {o.count !== undefined && (
                  <span className="mono text-muted-foreground ml-2 shrink-0 text-[10px]">
                    {o.count}
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-muted-foreground py-6 text-center text-sm">
                Ничего не найдено.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
