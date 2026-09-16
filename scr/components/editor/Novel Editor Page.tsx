import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import ChapterEditor from './Chapter Editor';
import ChapterSidebar from './Chapter Sidebar';
import VerticalPreview from './Vertical Preview';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

interface Novel {
  id: string;
  title: string;
  author: string;
  description: string;
  chapters: Chapter[];
}

export default function NovelEditorPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved'>('saved');

  // Initialize novel from localStorage or sample data
  useEffect(() => {
    if (!novelId) return;
    
    const storedNovels = localStorage.getItem('novels');
    let foundNovel = null;

    if (storedNovels) {
      const novels = JSON.parse(storedNovels);
      foundNovel = novels.find((n: Novel) => n.id === novelId);
    }

    if (!foundNovel) {
      // Sample data
      foundNovel = {
        id: novelId,
        title: '星屑の街',
        author: '著者不明',
        description: '夜空に浮かぶ街で繰り広げられる静かな物語。',
        chapters: [
          {
            id: 'ch-1',
            title: '序章 光の雨',
            content: '夜空に浮かぶ街。その名は――',
          },
        ],
      };
    }

    setNovel(foundNovel);
    setCurrentChapterId(foundNovel.chapters[0]?.id || '');
  }, [novelId]);

  const handleAddChapter = () => {
    if (!novel) return;
    const newChapter: Chapter = {
      id: `ch-${Date.now()}`,
      title: '新しい章',
      content: '',
    };
    const updatedNovel = {
      ...novel,
      chapters: [...novel.chapters, newChapter],
    };
    setNovel(updatedNovel);
    setCurrentChapterId(newChapter.id);
    setSaveStatus('unsaved');
  };

  const handleDeleteChapter = (chapterId: string) => {
    if (!novel || novel.chapters.length <= 1) return;
    const updatedChapters = novel.chapters.filter((ch) => ch.id !== chapterId);
    const updatedNovel = {
      ...novel,
      chapters: updatedChapters,
    };
    setNovel(updatedNovel);
    setCurrentChapterId(updatedChapters[0].id);
    setSaveStatus('unsaved');
  };

  const handleSelectChapter = (chapterId: string) => {
    setCurrentChapterId(chapterId);
  };

  const handleChangeTitle = (newTitle: string) => {
    if (!novel) return;
    const updatedChapters = novel.chapters.map((ch) =>
      ch.id === currentChapterId ? { ...ch, title: newTitle } : ch
    );
    setNovel({ ...novel, chapters: updatedChapters });
    setSaveStatus('unsaved');
  };

  const handleChangeContent = (newContent: string) => {
    if (!novel) return;
    const updatedChapters = novel.chapters.map((ch) =>
      ch.id === currentChapterId ? { ...ch, content: newContent } : ch
    );
    setNovel({ ...novel, chapters: updatedChapters });
    setSaveStatus('unsaved');
  };

  const handleSave = () => {
    if (!novel) return;
    const storedNovels = localStorage.getItem('novels');
    let novels = storedNovels ? JSON.parse(storedNovels) : [];
    const index = novels.findIndex((n: Novel) => n.id === novel.id);
    if (index >= 0) {
      novels[index] = novel;
    } else {
      novels.push(novel);
    }
    localStorage.setItem('novels', JSON.stringify(novels));
    setSaveStatus('saved');
  };

  if (!novel) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  const currentChapter = novel.chapters.find((ch) => ch.id === currentChapterId);

  return (
    <div className="flex h-screen bg-stone-100">
      {/* Sidebar */}
      <ChapterSidebar
        chapters={novel.chapters}
        currentChapterId={currentChapterId}
        onSelectChapter={handleSelectChapter}
        onAddChapter={handleAddChapter}
        onDeleteChapter={handleDeleteChapter}
      />

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 hover:bg-stone-100 rounded transition"
              title="戻る"
            >
              <ArrowLeft size={20} className="text-stone-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-stone-800">{novel.title}</h2>
              <p className="text-sm text-stone-500">著者: {novel.author}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center space-x-2 px-4 py-2 rounded transition ${
              saveStatus === 'saved'
                ? 'bg-stone-100 text-stone-600'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <Save size={16} />
            <span>{saveStatus === 'saved' ? '保存済み' : '保存'}</span>
          </button>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex overflow-hidden">
          {currentChapter && (
            <>
              <ChapterEditor
                title={currentChapter.title}
                content={currentChapter.content}
                onChangeTitle={handleChangeTitle}
                onChangeContent={handleChangeContent}
              />
              <VerticalPreview
                title={currentChapter.title}
                content={currentChapter.content}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
