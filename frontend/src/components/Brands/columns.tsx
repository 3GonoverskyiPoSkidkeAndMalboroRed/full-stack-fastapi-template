import type { ColumnDef } from "@tanstack/react-table"

import type { BrandPublic } from "@/client"
import { BrandActionsMenu } from "./BrandActionsMenu"

export const brandColumns: ColumnDef<BrandPublic>[] = [
  {
    accessorKey: "name",
    header: "Название",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Действия</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <BrandActionsMenu brand={row.original} />
      </div>
    ),
  },
]
