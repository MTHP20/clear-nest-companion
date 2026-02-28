import logoImage from '@/assets/clearnest-logo.png';

interface ClearNestLogoProps {
  variant?: 'default' | 'white' | 'small';
  className?: string;
}

export function ClearNestLogo({ variant = 'default', className = '' }: ClearNestLogoProps) {
  const textColor = variant === 'white' ? 'text-white' : 'text-foreground';
  const size = variant === 'small' ? 'h-8 w-8' : 'h-10 w-10';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src={logoImage} alt="ClearNest bird logo" className={`${size} rounded-full object-cover`} />
      <span className={`font-display text-xl font-semibold tracking-tight ${textColor}`}>
        ClearNest
      </span>
    </div>
  );
}
