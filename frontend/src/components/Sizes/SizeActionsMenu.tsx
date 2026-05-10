import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { SizePublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteSize from "./DeleteSize"
import EditSize from "./EditSize"

interface SizeActionsMenuProps {
  size: SizePublic
}

export const SizeActionsMenu = ({ size }: SizeActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditSize size={size} onSuccess={() => setOpen(false)} />
        <DeleteSize id={size.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
