```ts
/* =========================================================
   EditorController.ts
   縦読み小説エディタ PRO 2.0
========================================================= */

import { AppState } from '../app/AppState';

type NovelState = Readonly<
    import('../app/AppState').NovelState
>;


/* =========================================================
   EditorController
========================================================= */

export class EditorController {

    private unsubscribe?: () => void;

    private textareaElement:
        HTMLTextAreaElement | null = null;

    private chapterSelectElement:
        HTMLSelectElement | null = null;

    private initialized = false;


    constructor(
        private readonly state: AppState
    ) {}


    /* =====================================================
       Lifecycle
    ===================================================== */

    /**
     * EditorControllerを初期化する。
     *
     * 二重初期化を防止する。
     */
    public init(): void {

        if (this.initialized) {
            return;
        }

        this.cacheElements();

        this.bindEvents();

        this.unsubscribe =
            this.state.subscribe(
                this.handleStateChange
            );

        this.initialized = true;

        /*
         * 初期状態を即座にUIへ反映。
         */
        this.render(
            this.state.getState()
        );
    }


    /**
     * Controllerを破棄する。
     *
     * State購読とDOMイベントを
     * 確実に解除する。
     */
    public destroy(): void {

        this.unsubscribe?.();

        this.unsubscribe =
            undefined;

        this.removeEvents();

        this.textareaElement =
            null;

        this.chapterSelectElement =
            null;

        this.initialized =
            false;
    }


    /**
     * DOMを再取得して再描画する。
     *
     * モード切替などでDOMが再生成された場合に使用する。
     */
    public refreshViews(): void {

        if (!this.initialized) {
            this.init();
            return;
        }

        this.removeEvents();

        this.cacheElements();

        this.bindEvents();

        this.render(
            this.state.getState()
        );
    }


    /* =====================================================
       State
    ===================================================== */

    /**
     * AppState変更時のUI同期。
     */
    private handleStateChange = (
        newState: NovelState
    ): void => {

        if (!this.initialized) {
            return;
        }

        this.render(newState);
    };


    /* =====================================================
       DOM Cache
    ===================================================== */

    /**
     * Editor関連DOMを取得する。
     *
     * 現在のUIと将来的なUIの両方に
     * 対応できるよう複数セレクタを許容する。
     */
    private cacheElements(): void {

        this.textareaElement =
            document.querySelector<HTMLTextAreaElement>(
                '#editor-textarea, textarea[name="novel-content"]'
            );

        this.chapterSelectElement =
            document.querySelector<HTMLSelectElement>(
                '#chapter-select, select[name="chapter"]'
            );
    }


    /* =====================================================
       Events
    ===================================================== */

    /**
     * DOMイベントを登録する。
     */
    private bindEvents(): void {

        this.textareaElement?.addEventListener(
            'input',
            this.handleInput
        );

        this.chapterSelectElement?.addEventListener(
            'change',
            this.handleChapterChange
        );
    }


    /**
     * DOMイベントを解除する。
     */
    private removeEvents(): void {

        this.textareaElement?.removeEventListener(
            'input',
            this.handleInput
        );

        this.chapterSelectElement?.removeEventListener(
            'change',
            this.handleChapterChange
        );
    }


    /* =====================================================
       Input
    ===================================================== */

    /**
     * 本文入力。
     *
     * AppStateのupdateChapterContent()へ
     * 更新処理を委譲する。
     *
     * Controller側ではcharacterCountや
     * totalCharacterCountを計算しない。
     */
    private handleInput = (): void => {

        const textarea =
            this.textareaElement;

        if (!textarea) {
            return;
        }

        const state =
            this.state.getState();

        const currentChapter =
            state.chapters.find(
                chapter =>
                    chapter.id ===
                    state.currentChapterId
            );

        if (!currentChapter) {
            return;
        }

        const content =
            textarea.value;

        /*
         * 内容が同じならStateを更新しない。
         */
        if (
            currentChapter.content ===
            content
        ) {
            return;
        }

        /*
         * 本文更新はAppStateに一任する。
         *
         * AppState側で、
         *
         * ・characterCount
         * ・totalCharacterCount
         * ・saveStatus = dirty
         * ・notify()
         *
         * が一括して処理される。
         */
        this.state.updateChapterContent(
            currentChapter.id,
            content
        );
    };


    /* =====================================================
       Chapter
    ===================================================== */

    /**
     * 章切替。
     *
     * 章の存在確認やページ番号のリセットは
     * AppState.selectChapter()へ委譲する。
     */
    private handleChapterChange = (): void => {

        const select =
            this.chapterSelectElement;

        if (!select) {
            return;
        }

        const chapterId =
            select.value;

        if (!chapterId) {
            return;
        }

        /*
         * AppState側で、
         *
         * ・存在確認
         * ・currentChapterId更新
         * ・currentPageIndex = 0
         *
         * を行う。
         */
        this.state.selectChapter(
            chapterId
        );
    };


    /* =====================================================
       Render
    ===================================================== */

    /**
     * Editor UIをStateへ同期する。
     */
    private render(
        state: NovelState
    ): void {

        const currentChapter =
            state.chapters.find(
                chapter =>
                    chapter.id ===
                    state.currentChapterId
            );

        if (!currentChapter) {
            this.renderEmptyState();
            return;
        }

        this.renderTextarea(
            currentChapter.content
        );

        this.renderChapterSelect(
            state
        );
    }


    /**
     * 本文入力欄を更新する。
     *
     * 値が異なる場合のみ変更する。
     *
     * これにより、
     * State更新時にユーザーのカーソル位置を
     * 不必要に破壊することを防ぐ。
     */
    private renderTextarea(
        content: string
    ): void {

        const textarea =
            this.textareaElement;

        if (!textarea) {
            return;
        }

        if (
            textarea.value === content
        ) {
            return;
        }

        textarea.value =
            content;
    }


    /**
     * 章セレクトをStateへ同期する。
     */
    private renderChapterSelect(
        state: NovelState
    ): void {

        const select =
            this.chapterSelectElement;

        if (!select) {
            return;
        }

        const existingIds =
            Array.from(
                select.options
            ).map(
                option =>
                    option.value
            );

        const stateIds =
            state.chapters.map(
                chapter =>
                    chapter.id
            );

        /*
         * 章の追加・削除・順番変更を検出。
         */
        const structureChanged =
            existingIds.length !==
                stateIds.length ||
            existingIds.some(
                (id, index) =>
                    id !== stateIds[index]
            );

        if (structureChanged) {

            const fragment =
                document.createDocumentFragment();

            for (
                const chapter of state.chapters
            ) {

                const option =
                    document.createElement(
                        'option'
                    );

                option.value =
                    chapter.id;

                option.textContent =
                    chapter.title;

                fragment.appendChild(
                    option
                );
            }

            select.replaceChildren(
                fragment
            );

        } else {

            /*
             * 章タイトルのみ変更された場合。
             */
            state.chapters.forEach(
                (chapter, index) => {

                    const option =
                        select.options[index];

                    if (!option) {
                        return;
                    }

                    if (
                        option.textContent !==
                        chapter.title
                    ) {
                        option.textContent =
                            chapter.title;
                    }
                }
            );
        }

        /*
         * 現在章をStateへ同期。
         */
        if (
            select.value !==
            state.currentChapterId
        ) {
            select.value =
                state.currentChapterId;
        }
    }


    /**
     * 現在章が存在しない場合のUI。
     */
    private renderEmptyState(): void {

        if (this.textareaElement) {
            this.textareaElement.value =
                '';
        }

        if (this.chapterSelectElement) {

            this.chapterSelectElement
                .replaceChildren();

            this.chapterSelectElement.value =
                '';
        }
    }
}
```
