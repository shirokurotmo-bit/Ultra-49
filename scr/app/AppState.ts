```ts
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

    /**
     * 現在表示しているページ。
     *
     * ページ総数は画面サイズ・フォント・余白などで
     * 変化するためAppStateでは管理しない。
     */
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

/**
 * 一意なIDを生成する。
 */
function createId(
    prefix: string
): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return (
        `${prefix}-${Date.now()}-` +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}


/**
 * Unicodeコードポイント単位で文字数を数える。
 *
 * UTF-16コード単位ではなくArray.from()を使用する。
 *
 * 例:
 * 😀 = 1文字
 */
function countCharacters(
    text: string
): number {
    return Array.from(text).length;
}


/**
 * 初期章を生成。
 */
function createInitialChapter(): Chapter {
    return {
        id: 'ch-1',
        title: '第一章',
        content: '',
        characterCount: 0,
    };
}


/**
 * 初期状態を生成。
 */
function createInitialState(): NovelState {
    const chapter =
        createInitialChapter();

    return {
        title: '無題の作品',

        chapters: [
            chapter,
        ],

        currentChapterId:
            chapter.id,

        currentMode:
            'editor',

        currentPageIndex:
            0,

        totalCharacterCount:
            0,

        saveStatus:
            'idle',

        lastSavedAt:
            null,

        initialized:
            false,
    };
}


/* =========================================================
   AppState
========================================================= */

export class AppState {
    private state:
        NovelState =
        createInitialState();

    private readonly listeners =
        new Set<StateListener>();


    /* =====================================================
       Read
    ====================================================== */

    /**
     * 現在の状態を取得。
     */
    public getState():
        Readonly<NovelState> {
        return this.state;
    }


    /**
     * 現在の章を取得。
     *
     * 現在の章が存在しない場合は状態破損として扱う。
     */
    public getCurrentChapter():
        Readonly<Chapter> {
        const chapter =
            this.state.chapters.find(
                (item) =>
                    item.id ===
                    this.state.currentChapterId
            );

        if (!chapter) {
            throw new Error(
                `現在の章が見つかりません: ${this.state.currentChapterId}`
            );
        }

        return chapter;
    }


    /**
     * IDから章を取得。
     */
    public getChapter(
        chapterId: string
    ):
        Readonly<Chapter> | null {
        return (
            this.state.chapters.find(
                (chapter) =>
                    chapter.id ===
                    chapterId
            ) ?? null
        );
    }


    /* =====================================================
       Subscription
    ====================================================== */

    /**
     * 状態変更を購読。
     *
     * unsubscribe関数を返す。
     */
    public subscribe(
        listener: StateListener
    ): () => void {
        this.listeners.add(
            listener
        );

        return () => {
            this.listeners.delete(
                listener
            );
        };
    }


    /**
     * 購読者へ状態変更を通知。
     */
    private notify(): void {
        /*
         * 通知中にsubscribe/unsubscribeされても
         * 現在の通知処理へ影響しないようコピーする。
         */
        const listeners =
            Array.from(
                this.listeners
            );

        const snapshot =
            this.state;

        for (
            const listener of listeners
        ) {
            try {
                listener(snapshot);
            } catch (error) {
                /*
                 * 一つのUIコンポーネントの
                 * エラーで他の購読者を巻き込まない。
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
    ====================================================== */

    public markInitialized(): void {
        if (
            this.state.initialized
        ) {
            return;
        }

        this.update({
            initialized: true,
        });
    }


    /* =====================================================
       Novel
    ====================================================== */

    /**
     * 作品タイトルを変更。
     */
    public setTitle(
        title: string
    ): void {
        const normalizedTitle =
            title.trim().length > 0
                ? title
                : '無題の作品';

        if (
            this.state.title ===
            normalizedTitle
        ) {
            return;
        }

        this.update({
            title:
                normalizedTitle,

            saveStatus:
                'dirty',
        });
    }


    /* =====================================================
       Chapter
    ====================================================== */

    /**
     * 新しい章を追加。
     *
     * 追加した章を現在章にする。
     */
    public addChapter(
        title?: string
    ): string {
        const chapterNumber =
            this.state.chapters.length +
            1;

        const chapter: Chapter = {
            id: createId('ch'),

            title:
                title?.trim() ||
                `${this.toJapaneseNumber(chapterNumber)}章`,

            content: '',

            characterCount: 0,
        };

        this.state = {
            ...this.state,

            chapters: [
                ...this.state.chapters,
                chapter,
            ],

            currentChapterId:
                chapter.id,

            currentPageIndex:
                0,

            saveStatus:
                'dirty',
        };

        this.notify();

        return chapter.id;
    }


    /**
     * 章を選択。
     *
     * 章変更時は必ず先頭ページへ戻す。
     */
    public selectChapter(
        chapterId: string
    ): void {
        const exists =
            this.state.chapters.some(
                (chapter) =>
                    chapter.id ===
                    chapterId
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
            currentChapterId:
                chapterId,

            currentPageIndex:
                0,
        });
    }


    /**
     * 章タイトルを変更。
     */
    public renameChapter(
        chapterId: string,
        title: string
    ): void {
        const index =
            this.state.chapters.findIndex(
                (chapter) =>
                    chapter.id ===
                    chapterId
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
                (
                    chapter,
                    chapterIndex
                ) => {
                    if (
                        chapterIndex !==
                        index
                    ) {
                        return chapter;
                    }

                    return {
                        ...chapter,
                        title:
                            normalizedTitle,
                    };
                }
            );

        this.update({
            chapters,
            saveStatus:
                'dirty',
        });
    }


    /**
     * 章本文を更新。
     *
     * 本文と文字数を必ず同時に更新する。
     */
    public updateChapterContent(
        chapterId: string,
        content: string
    ): void {
        const index =
            this.state.chapters.findIndex(
                (chapter) =>
                    chapter.id ===
                    chapterId
            );

        if (index === -1) {
            console.warn(
                `存在しない章の本文を更新しようとしました: ${chapterId}`
            );

            return;
        }

        const current =
            this.state.chapters[index];

        const characterCount =
            countCharacters(
                content
            );

        if (
            current.content ===
                content &&
            current.characterCount ===
                characterCount
        ) {
            return;
        }

        const updatedChapter:
            Chapter = {
            ...current,

            content,

            characterCount,
        };

        const chapters =
            this.state.chapters.slice();

        chapters[index] =
            updatedChapter;

        const totalCharacterCount =
            chapters.reduce(
                (
                    total,
                    chapter
                ) =>
                    total +
                    chapter.characterCount,
                0
            );

        /*
         * 本文変更時は現在ページを
         * 先頭へ戻す。
         *
         * 以前のページ位置が新しい本文では
         * 存在しない可能性があるため。
         */
        const currentPageIndex =
            chapterId ===
            this.state.currentChapterId
                ? 0
                : this.state.currentPageIndex;

        this.state = {
            ...this.state,

            chapters,

            totalCharacterCount,

            currentPageIndex,

            saveStatus:
                'dirty',
        };

        this.notify();
    }


    /**
     * 章を削除。
     *
     * 最低1章は必ず残す。
     */
    public deleteChapter(
        chapterId: string
    ): void {
        if (
            this.state.chapters.length <=
            1
        ) {
            return;
        }

        const index =
            this.state.chapters.findIndex(
                (chapter) =>
                    chapter.id ===
                    chapterId
            );

        if (index === -1) {
            return;
        }

        const chapters =
            this.state.chapters.filter(
                (chapter) =>
                    chapter.id !==
                    chapterId
            );

        let currentChapterId =
            this.state.currentChapterId;

        /*
         * 現在章を削除した場合は
         * 直前の章へ移動。
         *
         * 直前が存在しなければ先頭。
         */
        if (
            currentChapterId ===
            chapterId
        ) {
            const fallbackIndex =
                Math.max(
                    0,
                    index - 1
                );

            const nextIndex =
                Math.min(
                    fallbackIndex,
                    chapters.length - 1
                );

            currentChapterId =
                chapters[
                    nextIndex
                ].id;
        }

        const totalCharacterCount =
            chapters.reduce(
                (
                    total,
                    chapter
                ) =>
                    total +
                    chapter.characterCount,
                0
            );

        this.state = {
            ...this.state,

            chapters,

            currentChapterId,

            currentPageIndex:
                0,

            totalCharacterCount,

            saveStatus:
                'dirty',
        };

        this.notify();
    }


    /* =====================================================
       Mode
    ====================================================== */

    /**
     * 表示モードを変更。
     *
     * モード変更ではページ位置をリセットしない。
     */
    public setMode(
        mode: AppMode
    ): void {
        if (
            this.state.currentMode ===
            mode
        ) {
            return;
        }

        this.state = {
            ...this.state,

            currentMode:
                mode,
        };

        this.notify();
    }


    /**
     * モード変更用エイリアス。
     */
    public toggleMode(
        mode: AppMode
    ): void {
        this.setMode(mode);
    }


    /* =====================================================
       Pagination
    ====================================================== */

    /**
     * 現在ページを変更。
     *
     * ページ総数はPaginationEngine側で
     * 管理するため、ここでは下限0だけ保証する。
     */
    public setPageIndex(
        pageIndex: number
    ): void {
        if (
            !Number.isFinite(
                pageIndex
            )
        ) {
            return;
        }

        const normalized =
            Math.max(
                0,
                Math.floor(
                    pageIndex
                )
            );

        if (
            this.state.currentPageIndex ===
            normalized
        ) {
            return;
        }

        this.update({
            currentPageIndex:
                normalized,
        });
    }


    /**
     * 次ページへ。
     *
     * 総ページ数が必要な境界判定は
     * ReaderController / UI側で行う。
     */
    public nextPage(): void {
        this.setPageIndex(
            this.state.currentPageIndex +
            1
        );
    }


    /**
     * 前ページへ。
     */
    public previousPage(): void {
        this.setPageIndex(
            Math.max(
                0,
                this.state.currentPageIndex -
                1
            )
        );
    }


    /**
     * ページを先頭へ戻す。
     */
    public resetPage(): void {
        this.setPageIndex(0);
    }


    /* =====================================================
       Save State
    ====================================================== */

    public markDirty(): void {
        if (
            this.state.saveStatus ===
            'dirty'
        ) {
            return;
        }

        this.update({
            saveStatus:
                'dirty',
        });
    }


    public markSaving(): void {
        this.update({
            saveStatus:
                'saving',
        });
    }


    public markSaved(
        timestamp = Date.now()
    ): void {
        this.update({
            saveStatus:
                'saved',

            lastSavedAt:
                timestamp,
        });
    }


    public markSaveError(): void {
        this.update({
            saveStatus:
                'error',
        });
    }


    /* =====================================================
       Reset
    ====================================================== */

    public reset(): void {
        this.state =
            createInitialState();

        this.notify();
    }


    /* =====================================================
       Replace State
    ====================================================== */

    /**
     * 外部から状態を置き換える。
     *
     * IndexedDB等からロードしたデータを
     * そのまま内部状態へ共有しない。
     */
    public replaceState(
        state: NovelState
    ): void {
        this.validateState(
            state
        );

        const chapters =
            state.chapters.map(
                (chapter) => ({
                    id:
                        chapter.id,

                    title:
                        chapter.title,

                    content:
                        chapter.content,

                    characterCount:
                        countCharacters(
                            chapter.content
                        ),
                })
            );

        const totalCharacterCount =
            chapters.reduce(
                (
                    total,
                    chapter
                ) =>
                    total +
                    chapter.characterCount,
                0
            );

        this.state = {
            ...state,

            chapters,

            totalCharacterCount,

            /*
             * ページ番号は保存データ側の値を
             * そのまま使用する。
             *
             * 実際に存在するページかどうかは
             * ReaderControllerがPaginationEngineの
             * 結果を使って補正する。
             */
            currentPageIndex:
                Math.max(
                    0,
                    Math.floor(
                        state.currentPageIndex
                    )
                ),
        };

        this.notify();
    }


    /* =====================================================
       Internal Update
    ====================================================== */

    private update(
        changes:
            Partial<NovelState>
    ): void {
        this.state = {
            ...this.state,
            ...changes,
        };

        this.notify();
    }


    /* =====================================================
       Validation
    ====================================================== */

    private validateState(
        state: NovelState
    ): void {
        if (
            !state ||
            typeof state !==
                'object'
        ) {
            throw new Error(
                '無効なNovelStateです。'
            );
        }

        if (
            !Array.isArray(
                state.chapters
            ) ||
            state.chapters.length ===
                0
        ) {
            throw new Error(
                '作品には最低1章必要です。'
            );
        }

        const currentChapterExists =
            state.chapters.some(
                (chapter) =>
                    chapter.id ===
                    state.currentChapterId
            );

        if (
            !currentChapterExists
        ) {
            throw new Error(
                'currentChapterIdに対応する章が存在しません。'
            );
        }

        if (
            !Number.isInteger(
                state.currentPageIndex
            ) ||
            state.currentPageIndex <
                0
        ) {
            throw new Error(
                'currentPageIndexが不正です。'
            );
        }

        if (
            !['editor', 'preview', 'reading']
                .includes(
                    state.currentMode
                )
        ) {
            throw new Error(
                'currentModeが不正です。'
            );
        }

        if (
            typeof state.title !==
            'string'
        ) {
            throw new Error(
                'titleが不正です。'
            );
        }
    }


    /* =====================================================
       Japanese Chapter Number
    ====================================================== */

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
            '九',
        ];

        if (
            number >= 1 &&
            number <= 9
        ) {
            return numerals[
                number
            ];
        }

        if (
            number === 10
        ) {
            return '十';
        }

        if (
            number < 20
        ) {
            return (
                `十${numerals[number - 10]}`
            );
        }

        if (
            number < 100
        ) {
            const tens =
                Math.floor(
                    number / 10
                );

            const ones =
                number % 10;

            return (
                `${
                    tens === 1
                        ? ''
                        : numerals[tens]
                }十${
                    ones > 0
                        ? numerals[ones]
                        : ''
                }`
            );
        }

        return String(number);
    }


    private getDefaultChapterTitle(
        chapterNumber: number
    ): string {
        return (
            `${this.toJapaneseNumber(
                chapterNumber
            )}章`
        );
    }
}
```
