import * as SwitchPrimitives from "@radix-ui/react-switch"
import * as React from "react"

import { cn } from "~/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "tw-peer tw-inline-flex tw-h-5 tw-w-9 tw-shrink-0 tw-cursor-pointer tw-items-center tw-rounded-full tw-border-2 tw-border-transparent tw-transition-colors tw-focus-visible:outline-none tw-focus-visible:ring-2 tw-focus-visible:ring-ring tw-focus-visible:ring-offset-2 tw-focus-visible:ring-offset-background tw-disabled:cursor-not-allowed tw-disabled:opacity-50 data-[state=checked]:tw-bg-primary data-[state=unchecked]:tw-bg-input",
      className
    )}
    {...props}
    ref={ref}>
    <SwitchPrimitives.Thumb
      className={cn(
        "tw-pointer-events-none tw-block tw-h-4 tw-w-4 tw-rounded-full tw-bg-background tw-shadow-lg tw-ring-0 tw-transition-transform data-[state=checked]:tw-translate-x-4 data-[state=unchecked]:tw-translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
