type Props = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export function Card({ children, className = '', onClick }: Props) {
  return (
    <div
      className={`bg-zinc-900 rounded-2xl ${onClick ? 'active:opacity-80 cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
