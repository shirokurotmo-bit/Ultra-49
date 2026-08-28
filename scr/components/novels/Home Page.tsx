import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Trash2 } from 'lucide-react';

interface Novel {
  id: string;
  title: string;
  author: string;
  description: string;
  coverColor: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [novels, setNovels] = useState<Novel[]>([
    {
      id: 'sample-1',
      title: '星屑の街',
      author: '著者不明',
      description: '夜空に浮かぶ街で繰り広げられる静かな物語。',
      coverColor: 'bg-stone-800',
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newNovel: Novel = {
      id: Date.now().toString(),
      title: newTitle,
      author: newAuthor || '未設定',
      description: '',
      coverColor: 'bg-stone-700',
    };
    setNovels([newNovel, ...novels]);
    setNewTitle('');
    setNewAuthor('');
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-stone-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-stone-800">小説一覧</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition shadow"
          >
            <Plus size={18} />
            <span>新規作品作成</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {novels.map((novel) => (
            <div
              key={novel.id}
              onClick={() => navigate(`/editor/${novel.id}`)}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer border border-stone-200 flex flex-col justify-between"
            >
              <div>
                <div className={`w-full h-32 rounded-lg ${novel.coverColor} mb-4 flex items-center justify-center text-white font-bold text-lg`}>
                  {novel.title}
                </div>
                <h3 className="font-bold text-lg text-stone-800 truncate">{novel.title}</h3>
                <p className="text-sm text-stone-500 mb-2">著者: {novel.author}</p>
                <p className="text-sm text-stone-600 line-clamp-2">{novel.description || 'あらすじなし'}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-100 flex justify-end space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/reader/${novel.id}`);
                  }}
                  className="p-2 text-stone-600 hover:bg-stone-100 rounded"
                  title="読む"
                >
                  <BookOpen size={16} />
                </Link>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNovels(novels.filter((n) => n.id !== novel.id));
                  }}
                  className="p-2 text-stone-400 hover:text-red-600 rounded"
                  title="削除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
            <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h2 className="text-xl font-bold mb-4 text-stone-800">新規作品の作成</h2>
              <input
                type="text"
                placeholder="作品タイトル"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full border border-stone-300 rounded p-2 mb-3 focus:outline-none focus:border-stone-500"
                required
              />
              <input
                type="text"
                placeholder="著者名"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                className="w-full border border-stone-300 rounded p-2 mb-4 focus:outline-none focus:border-stone-500"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 text-white rounded hover:bg-stone-800"
                >
                  作成する
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
