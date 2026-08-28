import React from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

interface ChapterSidebarProps {
  chapters: Chapter[];
  currentChapterId: string;
  onSelectChapter: (id: string) => void;
  onAddChapter: () => void;
  onDeleteChapter: (id: string) => void;
}

export default function ChapterSidebar({
  chapters,
  currentChapterId,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
}: ChapterSidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-stone-200 flex flex-col h-full">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <h2 className="font-bold text-stone-700">目次・章一覧</h2>
        <button
          onClick={onAddChapter}
          className="p-1.5 bg-stone-900 text-white rounded hover:bg-stone-800 transition"
          title="章を追加"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {chapters.map((ch, idx) => (
          <div
            key={ch.id}
            onClick={() => onSelectChapter(ch.id)}
            className={`group flex items-center justify-between p-2.5 rounded cursor-pointer text-sm transition ${
              ch.id === currentChapterId
                ? 'bg-stone-100 text-stone-900 font-bold'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              <FileText size={14} className="text-stone-400 shrink-0" />
              <span className="truncate">{idx + 1}. {ch.title || '無題の章'}</span>
            </div>
            {chapters.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChapter(ch.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-600 transition"
                title="削除"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
