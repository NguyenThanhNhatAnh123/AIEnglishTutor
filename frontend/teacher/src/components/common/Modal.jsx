import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl border border-slate-100`}
        style={{ animation: 'fadeInUp 0.2s ease' }}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        {/* Scrollable body so long forms keep actions reachable */}
        <div className="px-6 py-5 overflow-y-auto max-h-[75vh]">
          {children}
        </div>
      </div>
      <style>{`@keyframes fadeInUp { from { opacity:0; transform: translateY(12px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  );
}
