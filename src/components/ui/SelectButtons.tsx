type Props = {
  options: string[];
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  cols?: 3 | 4 | 2;
  scrollX?: boolean;
  multiSelect?: boolean;
};

function isSelected(value: string | string[] | undefined, opt: string): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.includes(opt);
  return value === opt;
}

export function SelectButtons({ options, value, onChange, cols = 3, scrollX = false, multiSelect = false }: Props) {
  function handleClick(opt: string) {
    if (multiSelect) {
      const arr = Array.isArray(value) ? value : (value ? [value] : []);
      const next = arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt];
      onChange(next);
    } else {
      const single = Array.isArray(value) ? value[0] : value;
      onChange(opt === single ? '' : opt);
    }
  }

  if (scrollX) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => handleClick(opt)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              isSelected(value, opt)
                ? 'bg-lime-400 text-black'
                : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700'
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
          onClick={() => handleClick(opt)}
          className={`py-2 px-1 rounded-xl text-sm font-medium transition-colors ${
            isSelected(value, opt)
              ? 'bg-lime-400 text-black'
              : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
