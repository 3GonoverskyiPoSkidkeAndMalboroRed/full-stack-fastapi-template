import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { BrandPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteBrand from "./DeleteBrand"
import EditBrand from "./EditBrand"

interface BrandActionsMenuProps {
  brand: BrandPublic
}

export const BrandActionsMenu = ({ brand }: BrandActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditBrand brand={brand} onSuccess={() => setOpen(false)} />
        <DeleteBrand id={brand.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
