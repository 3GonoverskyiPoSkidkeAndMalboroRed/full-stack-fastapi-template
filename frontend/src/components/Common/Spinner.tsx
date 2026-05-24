import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface SpinnerProps {
  className?: string
  label?: string
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] w-full flex-col items-center justify-center gap-3",
        className,
      )}
    >
      <Loader2 className="text-muted-foreground size-8 animate-spin" />
      {label && (
        <span className="text-muted-foreground text-sm tracking-wide">
          {label}
        </span>
      )}
    </div>
  )
}
