import { useEffect } from 'react';
import { X } from 'lucide-react';

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ll-ink/40" />
      <div
        className="relative bg-ll-surf rounded-t-3xl max-h-[92dvh] flex flex-col border-t border-ll-line"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-ll-line flex-shrink-0">
          <h2 className="text-lg font-bold text-ll-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-ll-mute active:bg-ll-s2"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
