import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { sizesReadSizes } from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SizeComboboxProps {
  value?: string | null
  onChange: (id: string | undefined) => void
  placeholder?: string
}

export function SizeCombobox({
  value,
  onChange,
  placeholder = "Select size",
}: SizeComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: sizes = [] } = useQuery({
    queryKey: ["sizes"],
    queryFn: () => sizesReadSizes(),
    select: (res) => res.data?.data ?? [],
  })

  const selected = sizes.find((s) => s.id === value)

  const filtered = useMemo(() => {
    if (!search) return sizes
    const q = search.toLowerCase()
    return sizes.filter((s) => s.name.toLowerCase().includes(q))
  }, [sizes, search])

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

  return (
    <div className="relative w-full" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={cn(!selected && "text-muted-foreground")}>
          {selected?.name ?? placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 w-full rounded-md border shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus
              placeholder="Search size..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                No size found.
              </div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => {
                    onChange(s.id === value ? undefined : s.id)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === s.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {s.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
