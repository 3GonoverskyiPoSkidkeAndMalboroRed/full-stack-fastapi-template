import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { itemsReadItemsPublic } from "@/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatPrice } from "@/lib/format"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setDebounced("")
    }
  }, [open])

  const { data, isFetching } = useQuery({
    queryKey: ["items", "search", debounced],
    queryFn: async () =>
      (
        await itemsReadItemsPublic({
          query: { q: debounced || undefined, limit: 12 },
        })
      ).data!,
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const results = data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-ink bg-paper rounded-none border-2 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Поиск по магазину
          </DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название товара…"
          className="border-ink h-11 rounded-none border-2 px-3 text-sm"
        />
        <div className="border-ink mt-2 max-h-[60vh] overflow-y-auto border-t">
          {isFetching && results.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-sm">Загрузка…</p>
          )}
          {!isFetching && results.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-sm">
              {debounced
                ? "Ничего не найдено"
                : "Начните вводить название товара"}
            </p>
          )}
          {results.map((item) => (
            <Link
              key={item.id}
              to="/catalog/$id"
              params={{ id: item.id }}
              onClick={() => onOpenChange(false)}
              className="border-ink/20 grid [grid-template-columns:1fr_auto_auto] items-center gap-4 border-b border-dashed px-3 py-3 transition-colors last:border-b-0 hover:bg-[color:var(--soft)]"
            >
              <span className="text-[15px] leading-tight font-medium">
                {item.title}
              </span>
              <span className="mono text-muted-foreground text-[11px] tracking-[0.06em]">
                {(item.stock ?? 0) > 0 ? "В наличии" : "Нет"}
              </span>
              <span className="mono text-[13px]">{formatPrice(item.cost)}</span>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
