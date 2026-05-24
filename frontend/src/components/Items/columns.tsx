import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Check, Copy } from "lucide-react"

import {
  categoriesReadCategories,
  type ItemPublic,
  sizesReadSizes,
} from "@/client"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { cn } from "@/lib/utils"
import { ItemActionsMenu } from "./ItemActionsMenu"

function SizeCell({ id }: { id: string | null | undefined }) {
  const { data: sizes = [] } = useQuery({
    queryKey: ["sizes"],
    queryFn: () => sizesReadSizes(),
    select: (res) => res.data?.data ?? [],
  })
  if (!id) return <span className="text-muted-foreground italic">—</span>
  const match = sizes.find((s) => s.id === id)
  return <span>{match?.name ?? id}</span>
}

function CategoryCell({ id }: { id: string | null | undefined }) {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesReadCategories(),
    select: (res) => res.data?.data ?? [],
  })
  if (!id) return <span className="text-muted-foreground italic">—</span>
  const match = categories.find((c) => c.id === id)
  return <span>{match?.name ?? id}</span>
}

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id

  return (
    <div className="group flex items-center gap-1.5">
      <span className="text-muted-foreground font-mono text-xs">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Скопировать ID</span>
      </Button>
    </div>
  )
}

export const columns: ColumnDef<ItemPublic>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "title",
    header: "Название",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.title}</span>
    ),
  },
  {
    accessorKey: "description",
    header: "Описание",
    cell: ({ row }) => {
      const description = row.original.description
      return (
        <span
          className={cn(
            "text-muted-foreground block max-w-xs truncate",
            !description && "italic",
          )}
        >
          {description || "Без описания"}
        </span>
      )
    },
  },
  {
    accessorKey: "category_id",
    header: "Категория",
    cell: ({ row }) => <CategoryCell id={row.original.category_id} />,
  },
  {
    accessorKey: "size_id",
    header: "Размер",
    cell: ({ row }) => <SizeCell id={row.original.size_id} />,
  },
  {
    accessorKey: "brand",
    header: "Бренд",
    cell: ({ row }) => {
      const brand = row.original.brand
      if (!brand) return <span className="text-muted-foreground italic">—</span>
      return <span>{brand.name}</span>
    },
  },
  {
    accessorKey: "cost",
    header: "Цена",
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Действия</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ItemActionsMenu item={row.original} />
      </div>
    ),
  },
]
