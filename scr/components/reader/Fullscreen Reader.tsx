import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Settings, ArrowLeft } from 'lucide-react';
import { ReaderSettings } from '../../lib/readerSettings';

interface FullscreenReaderProps {
  novelTitle: string;
  chapters: { id: string; title: string; content: string }[];
  initialChapterId: string;
  settings: ReaderSettings;
  onBack: () => void;
  onOpenSettings: () => void;
}

export default function FullscreenReader({
  novelTitle,
  chapters,
  initialChapterId,
  settings,
  onBack,
  onOpenSettings,
}: FullscreenReaderProps) {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(() => {
    const idx = chapters.findIndex((c) => c.id === initialChapterId);
    return idx >= 0 ? idx : 0;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const currentChapter = chapters[currentChapterIndex];

  const themeClasses = {
    paper: 'bg-[#fcfbf9] text-stone-800',
    white: 'bg-white text-gray-900',
    sepia: 'bg-[#f4ecd8] text-[#5c4033]',
    dark: 'bg-[#1e1e1e] text-stone-200',
    black: 'bg-black text-stone-300',
  };

  const handleNext = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  return (
    <div className={`fixed inset-0 flex flex-col ${themeClasses[settings.theme]} select-none overflow-hidden`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-stone-300/20 text-sm">
        <button onClick={onBack} className="flex items-center space-x-1 hover:opacity-70 transition">
          <ArrowLeft size={16} />
          <span>戻る</span>
        </button>
        <div className="font-bold truncate max-w-md">{novelTitle} - {currentChapter?.title}</div>
        <button onClick={onOpenSettings} className="p-1.5 hover:opacity-70 transition">
          <Settings size={18} />
        </button>
      </div>

      {/* リーダー本体 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto writing-mode-vertical p-12 relative flex items-start"
        style={{
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
          letterSpacing: `${settings.letterSpacing}em`,
          padding: `${settings.padding}px`,
        }}
      >
        <h2 className="text-2xl font-bold mb-8">{currentChapter?.title}</h2>
        <div className="whitespace-pre-wrap">{currentChapter?.content}</div>
      </div>

      {/* ページめくりコントロールボタン */}
      <div className="absolute inset-y-0 left-0 flex items-center p-4 pointer-events-none">
        <button
          onClick={handlePrev}
          className="pointer-events-auto p-3 bg-stone-500/20 hover:bg-stone-500/40 rounded-full backdrop-blur transition text-current"
        >
          <ChevronLeft size={24} />
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center p-4 pointer-events-none">
        <button
          onClick={handleNext}
          className="pointer-events-auto p-3 bg-stone-500/20 hover:bg-stone-500/40 rounded-full backdrop-blur transition text-current"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
