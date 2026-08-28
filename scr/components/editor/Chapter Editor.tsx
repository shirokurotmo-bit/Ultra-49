import React from 'react';

interface ChapterEditorProps {
  title: string;
  content: string;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
}

export default function ChapterEditor({
  title,
  content,
  onChangeTitle,
  onChangeContent,
}: ChapterEditorProps) {
  return (
    <div className="flex-1 flex flex-col h-full bg-white p-6 overflow-hidden">
      <input
        type="text"
        value={title}
        onChange={(e) => onChangeTitle(e.target.value)}
        placeholder="章のタイトルを入力..."
        className="text-2xl font-bold border-b border-stone-200 pb-2 mb-4 focus:outline-none focus:border-stone-500 text-stone-800"
      />
      <textarea
        value={content}
        onChange={(e) => onChangeContent(e.target.value)}
        placeholder="本文を入力してください..."
        className="flex-1 w-full resize-none focus:outline-none text-stone-700 leading-relaxed font-serif text-base"
      />
    </div>
  );
}
