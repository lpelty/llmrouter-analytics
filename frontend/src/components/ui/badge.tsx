import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-elevated text-secondary',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        'flash-lite': 'border-transparent bg-tier-flash-lite/20 text-tier-flash-lite',
        flash: 'border-transparent bg-tier-flash/20 text-tier-flash',
        grok: 'border-transparent bg-tier-grok/20 text-tier-grok',
        sonnet: 'border-transparent bg-tier-sonnet/20 text-tier-sonnet',
        misroute: 'border-transparent bg-tier-misroute/20 text-tier-misroute',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
