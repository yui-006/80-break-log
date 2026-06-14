type Props = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export function Card({ children, className = '', onClick }: Props) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm ${onClick ? 'active:shadow cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
