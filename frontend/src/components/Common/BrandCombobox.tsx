import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { type BrandCreate, brandsCreateBrand, brandsReadBrands } from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

interface BrandComboboxProps {
  value?: string | null
  onChange: (id: string | undefined) => void
  placeholder?: string
}

export function BrandCombobox({
  value,
  onChange,
  placeholder = "Выбрать бренд",
}: BrandComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: () => brandsReadBrands(),
    select: (res) => res.data?.data ?? [],
  })

  const createMutation = useMutation({
    mutationFn: (data: BrandCreate) => brandsCreateBrand({ body: data }),
    onSuccess: (res) => {
      showSuccessToast("Бренд создан")
      const newId = res.data?.id
      if (newId) onChange(newId)
      setOpen(false)
      setSearch("")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] })
    },
  })

  const selected = brands.find((b) => b.id === value)

  const trimmed = search.trim()
  const filtered = useMemo(() => {
    if (!search) return brands
    const q = search.toLowerCase()
    return brands.filter((b) => b.name.toLowerCase().includes(q))
  }, [brands, search])

  const exactMatch = useMemo(
    () => brands.some((b) => b.name.toLowerCase() === trimmed.toLowerCase()),
    [brands, trimmed],
  )

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
              placeholder="Поиск или новый бренд…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                className={cn(
                  "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => {
                  onChange(b.id === value ? undefined : b.id)
                  setOpen(false)
                  setSearch("")
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === b.id ? "opacity-100" : "opacity-0",
                  )}
                />
                {b.name}
              </button>
            ))}
            {trimmed && !exactMatch && (
              <button
                type="button"
                disabled={createMutation.isPending}
                className={cn(
                  "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => createMutation.mutate({ name: trimmed })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Создать «{trimmed}»
              </button>
            )}
            {filtered.length === 0 && !trimmed && (
              <div className="text-muted-foreground py-6 text-center text-sm">
                Бренд не найден.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
