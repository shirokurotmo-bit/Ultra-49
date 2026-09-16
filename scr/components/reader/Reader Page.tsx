import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DEFAULT_SETTINGS, ReaderSettings } from '../../lib/readerSettings';
import FullscreenReader from './Fullscreen Reader';

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

export default function ReaderPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

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
            content: '夜空に浮かぶ街。その名は――\n\nこの街には、ずっと前から星が降っていた。\nいつからそうなったのか、誰も知らない。\nだが、その光に包まれて、人々は静かに生きていた。',
          },
        ],
      };
    }

    setNovel(foundNovel);

    // Load settings from localStorage
    const savedSettings = localStorage.getItem('readerSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, [novelId]);

  const handleSettingsChange = (key: keyof ReaderSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('readerSettings', JSON.stringify(newSettings));
  };

  const handleBack = () => {
    navigate('/');
  };

  if (!novel) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <>
      <FullscreenReader
        novelTitle={novel.title}
        chapters={novel.chapters}
        initialChapterId={novel.chapters[0]?.id || ''}
        settings={settings}
        onBack={handleBack}
        onOpenSettings={() => setShowSettings(true)}
      />

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-stone-800">リーダー設定</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  フォントサイズ: {settings.fontSize}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={settings.fontSize}
                  onChange={(e) =>
                    handleSettingsChange('fontSize', parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  行の高さ: {settings.lineHeight.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={settings.lineHeight}
                  onChange={(e) =>
                    handleSettingsChange('lineHeight', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  文字間隔: {settings.letterSpacing.toFixed(2)}em
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={settings.letterSpacing}
                  onChange={(e) =>
                    handleSettingsChange('letterSpacing', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  テーマ
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) =>
                    handleSettingsChange(
                      'theme',
                      e.target.value as ReaderSettings['theme']
                    )
                  }
                  className="w-full border border-stone-300 rounded p-2 focus:outline-none focus:border-stone-500"
                >
                  <option value="paper">紙</option>
                  <option value="white">白</option>
                  <option value="sepia">セピア</option>
                  <option value="dark">ダーク</option>
                  <option value="black">ブラック</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.showAnimations}
                    onChange={(e) =>
                      handleSettingsChange('showAnimations', e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-stone-700">
                    アニメーションを表示
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-8 px-4 py-2 bg-stone-900 text-white rounded hover:bg-stone-800 transition"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
