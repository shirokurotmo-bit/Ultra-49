```ts
import { AppState } from '../app/AppState';

type NovelState = Readonly<
    import('../app/AppState').NovelState
>;

export class EditorController {
    private unsubscribe?: () => void;

    private textareaElement: HTMLTextAreaElement | null = null;
    private chapterSelectElement: HTMLSelectElement | null = null;

    private initialized = false;

    constructor(
        private readonly state: AppState
    ) {}

    /**
     * EditorControllerを初期化する。
     */
    public init(): void {
        if (this.initialized) {
            return;
        }

        this.cacheElements();
        this.bindEvents();

        this.unsubscribe = this.state.subscribe(
            (newState) => {
                this.render(newState);
            }
        );

        this.initialized = true;

        this.render(
            this.state.getState()
        );
    }

    /**
     * Controllerを破棄する。
     *
     * State購読とDOMイベントを確実に解除する。
     */
    public destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;

        this.removeEvents();

        this.textareaElement = null;
        this.chapterSelectElement = null;

        this.initialized = false;
    }

    /**
     * DOMを再取得して再描画する。
     *
     * モード切替やDOM再生成後に使用する。
     */
    public refreshViews(): void {
        this.removeEvents();

        this.cacheElements();
        this.bindEvents();

        this.render(
            this.state.getState()
        );
    }

    /**
     * Editor関連DOMを取得する。
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

    /**
     * DOMイベントを登録する。
     */
    private bindEvents(): void {
        if (this.textareaElement) {
            this.textareaElement.addEventListener(
                'input',
                this.handleInput
            );
        }

        if (this.chapterSelectElement) {
            this.chapterSelectElement.addEventListener(
                'change',
                this.handleChapterChange
            );
        }
    }

    /**
     * DOMイベントを解除する。
     */
    private removeEvents(): void {
        if (this.textareaElement) {
            this.textareaElement.removeEventListener(
                'input',
                this.handleInput
            );
        }

        if (this.chapterSelectElement) {
            this.chapterSelectElement.removeEventListener(
                'change',
                this.handleChapterChange
            );
        }
    }

    /**
     * 本文入力。
     *
     * 現在の章だけを更新する。
     */
    private handleInput = (): void => {
        const textarea =
            this.textareaElement;

        if (!textarea) {
            return;
        }

        const currentText =
            textarea.value;

        const state =
            this.state.getState();

        const currentChapter =
            state.chapters.find(
                (chapter) =>
                    chapter.id ===
                    state.currentChapterId
            );

        if (!currentChapter) {
            return;
        }

        /*
         * 内容に変更がない場合はStateを更新しない。
         */
        if (
            currentChapter.content ===
            currentText
        ) {
            return;
        }

        const updatedChapters =
            state.chapters.map(
                (chapter) => {
                    if (
                        chapter.id !==
                        state.currentChapterId
                    ) {
                        return chapter;
                    }

                    return {
                        ...chapter,
                        content: currentText,
                        characterCount:
                            Array.from(
                                currentText
                            ).length,
                    };
                }
            );

        this.state.setState({
            chapters: updatedChapters,
        });
    };

    /**
     * 章切替。
     */
    private handleChapterChange = (): void => {
        const select =
            this.chapterSelectElement;

        if (!select) {
            return;
        }

        const newChapterId =
            select.value;

        const state =
            this.state.getState();

        /*
         * 存在しない章IDはStateへ設定しない。
         */
        const targetChapter =
            state.chapters.find(
                (chapter) =>
                    chapter.id ===
                    newChapterId
            );

        if (!targetChapter) {
            return;
        }

        /*
         * 同じ章なら何もしない。
         */
        if (
            state.currentChapterId ===
            newChapterId
        ) {
            return;
        }

        this.state.setState({
            currentChapterId:
                newChapterId,
            currentPageIndex: 0,
        });
    };

    /**
     * Editor UIをStateへ同期する。
     */
    private render(
        state: NovelState
    ): void {
        const currentChapter =
            state.chapters.find(
                (chapter) =>
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
     * ユーザー入力中にカーソルを奪わないよう、
     * 値が異なる場合のみ更新する。
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
            textarea.value !== content
        ) {
            textarea.value = content;
        }
    }

    /**
     * 章セレクトをStateへ同期する。
     *
     * innerHTMLは使用せず、optionをDOM APIで生成する。
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
                (option) =>
                    option.value
            );

        const stateIds =
            state.chapters.map(
                (chapter) =>
                    chapter.id
            );

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
             * 章タイトルだけ変更された場合にも
             * セレクト表示を同期する。
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

        if (
            select.value !==
            state.currentChapterId
        ) {
            select.value =
                state.currentChapterId;
        }
    }

    /**
     * 現在章が存在しない場合のUIクリア。
     */
    private renderEmptyState(): void {
        if (this.textareaElement) {
            this.textareaElement.value =
                '';
        }

        if (this.chapterSelectElement) {
            this.chapterSelectElement.value =
                '';
        }
    }
}
```
