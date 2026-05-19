import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullScreen?: boolean;
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export function Spinner({ size = 'md', className = '', fullScreen = false }: SpinnerProps) {
  const spinner = (
    <div className={`flex justify-center items-center ${className}`}>
      <Loader2
        className={`animate-spin ${sizes[size]}`}
        style={{ color: 'var(--brand-yellow)' }}
      />
    </div>
  );
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-white/80 z-50">
        {spinner}
      </div>
    );
  }
  return spinner;
}
