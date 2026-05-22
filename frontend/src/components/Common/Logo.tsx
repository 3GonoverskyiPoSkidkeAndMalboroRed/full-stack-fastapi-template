import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

const FULL_TEXT = "РЕЕСТР13"
const ICON_TEXT = "Р13"

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const content =
    variant === "responsive" ? (
      <span
        aria-label="РЕЕСТР13"
        className={cn(
          "brand-mark inline-flex items-baseline",
          "group-data-[collapsible=icon]:hidden",
          className,
        )}
      >
        {FULL_TEXT}
        <span
          aria-hidden="true"
          className="brand-mark hidden group-data-[collapsible=icon]:inline"
        >
          {ICON_TEXT}
        </span>
      </span>
    ) : (
      <span
        aria-label="РЕЕСТР13"
        className={cn(
          "brand-mark inline-flex items-baseline",
          variant === "icon" && "text-xl",
          className,
        )}
      >
        {variant === "full" ? FULL_TEXT : ICON_TEXT}
      </span>
    )

  if (!asLink) {
    return content
  }

  return (
    <Link to="/" className="inline-flex">
      {content}
    </Link>
  )
}
