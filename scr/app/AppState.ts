/* =========================================================
   AppState.ts
   縦読み小説エディタ PRO 2.0
========================================================= */

export type AppMode =
    | 'editor'
    | 'preview'
    | 'reading';

export type SaveStatus =
    | 'idle'
    | 'saving'
    | 'saved'
    | 'dirty'
    | 'error';

export interface Chapter {
    readonly id: string;
    title: string;
    content: string;
    readonly characterCount: number;
}

export interface NovelState {
    readonly title: string;
    readonly chapters: readonly Chapter[];

    readonly currentChapterId: string;

    readonly currentMode: AppMode;

    readonly currentPageIndex: number;

    readonly totalCharacterCount: number;

    readonly saveStatus: SaveStatus;

    readonly lastSavedAt: number | null;

    readonly initialized: boolean;
}

export type StateListener = (
    state: Readonly<NovelState>
) => void;


/* =========================================================
   Utility
========================================================= */

function createId(prefix: string): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
}


function countCharacters(text: string): number {
    /*
        Array.from() を使用することで、
        JavaScriptのUTF-16コード単位ではなく
        Unicodeコードポイント単位で数える。

        例:
        😀 = 1文字
    */

    return Array.from(text).length;
}


function createInitialChapter(): Chapter {
    return {
        id: 'ch-1',
        title: '第一章',
        content: '',
        characterCount: 0
    };
}


function createInitialState(): NovelState {
    const chapter = createInitialChapter();

    return {
        title: '無題の作品',

        chapters: [chapter],

        currentChapterId: chapter.id,

        currentMode: 'editor',

        currentPageIndex: 0,

        totalCharacterCount: 0,

        saveStatus: 'idle',

        lastSavedAt: null,

        initialized: false
    };
}


/* =========================================================
   AppState
========================================================= */

export class AppState {

    private state: NovelState = createInitialState();

    private readonly listeners =
        new Set<StateListener>();


    /* =====================================================
       Read
    ===================================================== */

    public getState(): Readonly<NovelState> {
        return this.state;
    }


    public getCurrentChapter(): Readonly<Chapter> {
        const chapter = this.state.chapters.find(
            item =>
                item.id === this.state.currentChapterId
        );

        /*
            状態の整合性が壊れている場合、
            静かにundefinedを返すより即座に異常を知らせる。
        */

        if (!chapter) {
            throw new Error(
                `現在の章が見つかりません: ${this.state.currentChapterId}`
            );
        }

        return chapter;
    }


    public getChapter(
        chapterId: string
    ): Readonly<Chapter> | null {

        return (
            this.state.chapters.find(
                chapter =>
                    chapter.id === chapterId
            ) ?? null
        );
    }


    /* =====================================================
       Subscription
    ===================================================== */

    public subscribe(
        listener: StateListener
    ): () => void {

        this.listeners.add(listener);

        /*
            unsubscribe関数を返す。
        */

        return () => {
            this.listeners.delete(listener);
        };
    }


    private notify(): void {

        /*
            Setをコピーしてから通知。

            listener内でsubscribe/unsubscribeされても
            現在の通知処理が壊れない。
        */

        const listeners = Array.from(
            this.listeners
        );

        const snapshot = this.state;

        for (const listener of listeners) {
            try {
                listener(snapshot);
            } catch (error) {
                /*
                    一つのUIコンポーネントのエラーで
                    他の購読者まで巻き込まない。
                */

                console.error(
                    'AppState listener error:',
                    error
                );
            }
        }
    }


    /* =====================================================
       Initialization
    ===================================================== */

    public markInitialized(): void {

        if (this.state.initialized) {
            return;
        }

        this.update({
            initialized: true
        });
    }


    /* =====================================================
       Novel
    ===================================================== */

    public setTitle(title: string): void {

        const normalizedTitle =
            title.trim().length > 0
                ? title
                : '無題の作品';

        if (
            this.state.title === normalizedTitle
        ) {
            return;
        }

        this.update({
            title: normalizedTitle,
            saveStatus: 'dirty'
        });
    }


    /* =====================================================
       Chapter
    ===================================================== */

    public addChapter(
        title?: string
    ): string {

        const chapterNumber =
            this.state.chapters.length + 1;

        const chapter: Chapter = {
            id: createId('ch'),
            title:
                title?.trim() ||
                `${this.toJapaneseNumber(chapterNumber)}章`,
            content: '',
            characterCount: 0
        };

        this.state = {
            ...this.state,

            chapters: [
                ...this.state.chapters,
                chapter
            ],

            currentChapterId: chapter.id,

            currentPageIndex: 0,

            saveStatus: 'dirty'
        };

        this.notify();

        return chapter.id;
    }


    public selectChapter(
        chapterId: string
    ): void {

        const exists =
            this.state.chapters.some(
                chapter =>
                    chapter.id === chapterId
            );

        if (!exists) {
            console.warn(
                `存在しない章を選択しようとしました: ${chapterId}`
            );

            return;
        }

        if (
            this.state.currentChapterId ===
            chapterId
        ) {
            return;
        }

        this.update({
            currentChapterId: chapterId,

            /*
                章が変わったら必ず先頭ページへ戻す。
                ここを忘れると、
                「第3章に切り替えたら存在しないページ」
                のような事故が起こる。
            */

            currentPageIndex: 0
        });
    }


    public renameChapter(
        chapterId: string,
        title: string
    ): void {

        const index =
            this.state.chapters.findIndex(
                chapter =>
                    chapter.id === chapterId
            );

        if (index === -1) {
            return;
        }

        const normalizedTitle =
            title.trim() ||
            this.getDefaultChapterTitle(
                index + 1
            );

        const chapters =
            this.state.chapters.map(
                (chapter, chapterIndex) => {

                    if (
                        chapterIndex !== index
                    ) {
                        return chapter;
                    }

                    return {
                        ...chapter,
                        title: normalizedTitle
                    };
                }
            );

        this.update({
            chapters,
            saveStatus: 'dirty'
        });
    }


    public updateChapterContent(
        chapterId: string,
        content: string
    ): void {

        const index =
            this.state.chapters.findIndex(
                chapter =>
                    chapter.id === chapterId
            );

        if (index === -1) {
            console.warn(
                `存在しない章の本文を更新しようとしました: ${chapterId}`
            );

            return;
        }

        const current =
            this.state.chapters[index];

        /*
            本文と文字数を同じ処理で更新する。

            characterCountを別の場所から
            手動更新させないことが重要。
        */

        const characterCount =
            countCharacters(content);

        if (
            current.content === content &&
            current.characterCount ===
                characterCount
        ) {
            return;
        }

        const updatedChapter: Chapter = {
            ...current,

            content,

            characterCount
        };

        const chapters =
            this.state.chapters.slice();

        chapters[index] =
            updatedChapter;

        const totalCharacterCount =
            chapters.reduce(
                (total, chapter) =>
                    total +
                    chapter.characterCount,
                0
            );

        this.state = {
            ...this.state,

            chapters,

            totalCharacterCount,

            saveStatus: 'dirty'
        };

        this.notify();
    }


    public deleteChapter(
        chapterId: string
    ): void {

        /*
            最低1章は必ず残す。

            小説エディタで章0個は、
            UI上も保存上も無意味なので禁止。
        */

        if (
            this.state.chapters.length <= 1
        ) {
            return;
        }

        const index =
            this.state.chapters.findIndex(
                chapter =>
                    chapter.id === chapterId
            );

        if (index === -1) {
            return;
        }

        const chapters =
            this.state.chapters.filter(
                chapter =>
                    chapter.id !== chapterId
            );

        let currentChapterId =
            this.state.currentChapterId;

        /*
            現在表示中の章を削除した場合は、
            直前の章、なければ先頭へ移動。
        */

        if (
            currentChapterId === chapterId
        ) {
            const fallbackIndex =
                Math.max(0, index - 1);

            currentChapterId =
                chapters[
                    Math.min(
                        fallbackIndex,
                        chapters.length - 1
                    )
                ].id;
        }

        const totalCharacterCount =
            chapters.reduce(
                (total, chapter) =>
                    total +
                    chapter.characterCount,
                0
            );

        this.state = {
            ...this.state,

            chapters,

            currentChapterId,

            currentPageIndex: 0,

            totalCharacterCount,

            saveStatus: 'dirty'
        };

        this.notify();
    }


    /* =====================================================
       Mode
    ===================================================== */

    public setMode(
        mode: AppMode
    ): void {

        if (
            this.state.currentMode === mode
        ) {
            return;
        }

        this.state = {
            ...this.state,

            currentMode: mode,

            /*
                モード変更時にページ位置を
                勝手にリセットしない。

                Preview → Readingなどで
                読んでいた位置を維持できる。
            */
        };

        this.notify();
    }


    public toggleMode(
        mode: AppMode
    ): void {

        this.setMode(mode);
    }


    /* =====================================================
       Pagination
    ===================================================== */

    public setPageIndex(
        pageIndex: number
    ): void {

        if (
            !Number.isFinite(pageIndex)
        ) {
            return;
        }

        const normalized =
            Math.max(
                0,
                Math.floor(pageIndex)
            );

        if (
            this.state.currentPageIndex ===
            normalized
        ) {
            return;
        }

        this.update({
            currentPageIndex: normalized
        });
    }


    public nextPage(): void {

        this.setPageIndex(
            this.state.currentPageIndex + 1
        );
    }


    public previousPage(): void {

        this.setPageIndex(
            this.state.currentPageIndex - 1
        );
    }


    /* =====================================================
       Save State
    ===================================================== */

    public markDirty(): void {

        if (
            this.state.saveStatus ===
            'dirty'
        ) {
            return;
        }

        this.update({
            saveStatus: 'dirty'
        });
    }


    public markSaving(): void {

        this.update({
            saveStatus: 'saving'
        });
    }


    public markSaved(
        timestamp = Date.now()
    ): void {

        this.update({
            saveStatus: 'saved',

            lastSavedAt: timestamp
        });
    }


    public markSaveError(): void {

        this.update({
            saveStatus: 'error'
        });
    }


    /* =====================================================
       Reset
    ===================================================== */

    public reset(): void {

        this.state =
            createInitialState();

        this.notify();
    }


    public replaceState(
        state: NovelState
    ): void {

        this.validateState(state);

        /*
            外部から渡された配列・章オブジェクトを
            そのまま保持しない。

            IndexedDBから読み込んだデータなどを
            State内部と共有すると、意図しない変更が
            起きる可能性があるため。
        */

        const chapters =
            state.chapters.map(
                chapter => ({
                    id: chapter.id,
                    title: chapter.title,
                    content: chapter.content,
                    characterCount:
                        countCharacters(
                            chapter.content
                        )
                })
            );

        const totalCharacterCount =
            chapters.reduce(
                (total, chapter) =>
                    total +
                    chapter.characterCount,
                0
            );

        this.state = {
            ...state,

            chapters,

            totalCharacterCount
        };

        this.notify();
    }


    /* =====================================================
       Internal Update
    ===================================================== */

    private update(
        changes: Partial<NovelState>
    ): void {

        this.state = {
            ...this.state,
            ...changes
        };

        this.notify();
    }


    /* =====================================================
       Validation
    ===================================================== */

    private validateState(
        state: NovelState
    ): void {

        if (
            !state ||
            typeof state !== 'object'
        ) {
            throw new Error(
                '無効なNovelStateです。'
            );
        }

        if (
            !Array.isArray(state.chapters) ||
            state.chapters.length === 0
        ) {
            throw new Error(
                '作品には最低1章必要です。'
            );
        }

        const currentChapterExists =
            state.chapters.some(
                chapter =>
                    chapter.id ===
                    state.currentChapterId
            );

        if (!currentChapterExists) {
            throw new Error(
                'currentChapterIdに対応する章が存在しません。'
            );
        }

        if (
            !Number.isInteger(
                state.currentPageIndex
            ) ||
            state.currentPageIndex < 0
        ) {
            throw new Error(
                'currentPageIndexが不正です。'
            );
        }
    }


    /* =====================================================
       Japanese Chapter Number
    ===================================================== */

    private toJapaneseNumber(
        number: number
    ): string {

        const numerals = [
            '〇',
            '一',
            '二',
            '三',
            '四',
            '五',
            '六',
            '七',
            '八',
            '九'
        ];

        if (
            number >= 1 &&
            number <= 9
        ) {
            return numerals[number];
        }

        if (
            number === 10
        ) {
            return '十';
        }

        if (
            number < 20
        ) {
            return `十${numerals[number - 10]}`;
        }

        if (
            number < 100
        ) {
            const tens =
                Math.floor(number / 10);

            const ones =
                number % 10;

            return (
                `${tens === 1
                    ? ''
                    : numerals[tens]}十` +
                (ones > 0
                    ? numerals[ones]
                    : '')
            );
        }

        return String(number);
    }


    private getDefaultChapterTitle(
        chapterNumber: number
    ): string {

        return `${this.toJapaneseNumber(
            chapterNumber
        )}章`;
    }
}
