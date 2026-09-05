import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[#C86246] shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-[#B95B64] shrink-0" />,
    info: <Info className="w-5 h-5 text-[#38222C] shrink-0" />,
  };

  const borders = {
    success: 'border-[#F0D4C5] bg-[#FFFFFF] text-[#2D1B22]',
    error: 'border-[#F7DEE0] bg-[#FFFFFF] text-[#B95B64]',
    info: 'border-[#DFD5C6] bg-[#FFFFFF] text-[#2D1B22]',
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 animate-slide-up pointer-events-none flex justify-end">
      <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl w-full sm:w-auto max-w-md ${borders[toast.type || 'info']}`}>
        {icons[toast.type || 'info']}
        <p className="text-xs font-mono-code font-bold pr-2 break-words flex-1">{toast.message}</p>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[#EFE8E1] transition-colors text-[#7D6F73] hover:text-[#2D1B22] cursor-pointer ml-auto shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
