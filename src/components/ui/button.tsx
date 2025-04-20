import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "tw-inline-flex tw-items-center tw-justify-center tw-whitespace-nowrap tw-rounded-md tw-text-sm tw-font-medium tw-transition-colors tw-focus-visible:outline-none tw-focus-visible:ring-2 tw-focus-visible:ring-ring tw-focus-visible:ring-offset-2 tw-disabled:opacity-50 tw-disabled:pointer-events-none tw-ring-offset-background",
  {
    variants: {
      variant: {
        default: "tw-bg-primary tw-text-primary-foreground tw-hover:bg-primary/90",
        destructive:
          "tw-bg-destructive tw-text-destructive-foreground tw-hover:bg-destructive/90",
        outline:
          "tw-border tw-border-input tw-hover:bg-accent tw-hover:text-accent-foreground",
        secondary:
          "tw-bg-secondary tw-text-secondary-foreground tw-hover:bg-secondary/80",
        ghost: "tw-hover:bg-accent tw-hover:text-accent-foreground",
        link: "tw-underline-offset-4 tw-hover:underline tw-text-primary",
      },
      size: {
        default: "tw-h-10 tw-py-2 tw-px-4",
        sm: "tw-h-9 tw-px-3 tw-rounded-md",
        lg: "tw-h-11 tw-px-8 tw-rounded-md",
        icon: "tw-h-10 tw-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants }; 