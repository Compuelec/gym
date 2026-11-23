import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[colors,transform] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:brightness-110',
        // The brand gradient: the one main action of a screen (start, propose, log a set).
        brand: 'bg-brand font-display text-base uppercase tracking-wider shadow-card hover:brightness-110',
        outline: 'border border-border bg-card text-card-foreground hover:bg-muted',
        ghost: 'hover:bg-muted',
        destructive: 'border border-danger/40 bg-danger-soft text-danger hover:brightness-95',
      },
      size: { default: 'h-11 px-4', sm: 'h-9 px-3', lg: 'h-13 px-6 text-base' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
