type Props = {
  options: string[];
  value: string | undefined;
  onChange: (v: string) => void;
  cols?: 3 | 4 | 2;
  scrollX?: boolean;
};

export function SelectButtons({ options, value, onChange, cols = 3, scrollX = false }: Props) {
  if (scrollX) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt === value ? '' : opt)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              value === opt
                ? 'bg-green-800 text-white'
                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  const gridClass = cols === 4 ? 'grid-cols-4' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`grid ${gridClass} gap-2`}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === value ? '' : opt)}
          className={`py-2 px-1 rounded-xl text-sm font-medium transition-colors ${
            value === opt
              ? 'bg-green-800 text-white'
              : 'bg-gray-100 text-gray-700 active:bg-gray-200'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
