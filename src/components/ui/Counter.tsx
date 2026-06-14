type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
  defaultValue?: number;
};

export function Counter({ label, value, onChange, min = 0, max = 99, compact = false, defaultValue }: Props) {
  const isUnset = value === 0 && defaultValue !== undefined;

  function handleMinus() {
    if (isUnset) { onChange(defaultValue!); return; }
    onChange(Math.max(min, value - 1));
  }

  function handlePlus() {
    if (isUnset) { onChange(defaultValue!); return; }
    onChange(Math.min(max, value + 1));
  }

  return (
    <div className={`flex items-center justify-between ${compact ? 'py-1' : 'py-2'}`}>
      <span className={`text-zinc-300 font-medium ${compact ? 'text-sm' : 'text-base'}`}>{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleMinus}
          className={`flex items-center justify-center rounded-full bg-zinc-800 active:bg-zinc-700 font-bold text-white ${
            compact ? 'w-8 h-8 text-lg' : 'w-11 h-11 text-2xl'
          }`}
        >
          −
        </button>
        <span className={`font-bold text-white w-8 text-center ${compact ? 'text-lg' : 'text-2xl'}`}>
          {isUnset ? '−' : value}
        </span>
        <button
          type="button"
          onClick={handlePlus}
          className={`flex items-center justify-center rounded-full bg-lime-400 active:bg-lime-300 text-black font-bold ${
            compact ? 'w-8 h-8 text-lg' : 'w-11 h-11 text-2xl'
          }`}
        >
          +
        </button>
      </div>
    </div>
  );
}
