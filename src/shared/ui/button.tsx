import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/ui/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center font-primary text-sm tracking-[0.2em] uppercase transition-all duration-500 cursor-pointer disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-cold-white-ghost text-cold-white bg-transparent hover:border-cold-white-dim hover:shadow-[0_0_40px_rgba(59,91,219,0.15),inset_0_0_40px_rgba(59,91,219,0.15)]',
        ghost:
          'text-cold-white-dim hover:text-cold-white bg-transparent',
      },
      size: {
        default: 'px-8 py-3',
        sm: 'px-4 py-2 text-xs',
        lg: 'px-12 py-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button }
export type { ButtonProps }
