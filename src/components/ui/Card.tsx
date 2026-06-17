type Props = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export function Card({ children, className = '', onClick }: Props) {
  return (
    <div
      className={`bg-ll-surf border border-ll-line rounded-[22px] shadow-card ${onClick ? 'active:opacity-80 cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
