import type { ColumnDef } from "@tanstack/react-table"

import type { SizePublic } from "@/client"
import { SizeActionsMenu } from "./SizeActionsMenu"

export const sizeColumns: ColumnDef<SizePublic>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <SizeActionsMenu size={row.original} />
      </div>
    ),
  },
]
