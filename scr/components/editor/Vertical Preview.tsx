import React from 'react';

interface VerticalPreviewProps {
  title: string;
  content: string;
}

export default function VerticalPreview({ title, content }: VerticalPreviewProps) {
  return (
    <div className="w-1/2 bg-stone-50 border-l border-stone-200 p-8 overflow-x-auto h-full flex flex-col">
      <div className="text-xs font-bold text-stone-400 mb-4 tracking-widest">縦書きプレビュー</div>
      <div className="flex-1 overflow-x-auto border border-stone-200 bg-[#fefdfb] p-6 shadow-sm">
        <div className="writing-mode-vertical h-full max-h-[600px] text-stone-800 space-y-8 select-none">
          <h3 className="text-xl font-bold tracking-wider pb-4">{title}</h3>
          <div className="whitespace-pre-wrap leading-loose text-base tracking-normal">
            {content || '（本文がありません）'}
          </div>
        </div>
      </div>
    </div>
  );
}
