import { h } from 'preact';
import type { ComponentChildren } from 'preact';

interface BadgeProps {
  className?: string;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger';
  children: ComponentChildren;
}

export function Badge({ className = '', variant = 'default', children }: BadgeProps) {
  const variantClasses = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
