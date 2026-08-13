import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-foreground text-background",
        outline: "border-border bg-background text-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        muted: "border-border/60 bg-muted/60 text-muted-foreground",
        info: "border-info/20 bg-info/10 text-info",
        purple: "border-purple/20 bg-purple/10 text-purple",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/25 bg-warning/15 text-warning",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  }
)

const dotColor: Record<string, string> = {
  info: "bg-info",
  purple: "bg-purple",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/60",
  default: "bg-background/80",
  secondary: "bg-foreground/60",
  outline: "bg-foreground/60",
}

function Badge({
  className,
  variant = "muted",
  withDot = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; withDot?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {withDot && <span className={cn("h-2 w-2 rounded-full", dotColor[variant ?? "muted"])} />}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
