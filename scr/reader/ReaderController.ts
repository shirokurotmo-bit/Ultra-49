import { AppState } from '../app/AppState';
import { PaginationEngine } from '../pagination/PaginationEngine';

type NovelState = Readonly<import('../app/AppState').NovelState>;

interface ReaderView {
    content: HTMLElement;
    currentPage?: HTMLElement;
    totalPages?: HTMLElement;
}

export class ReaderController {
    private unsubscribe?: () => void;
    private views: ReaderView[] = [];
    private lastChapterId?: string;
    private lastPageIndex = -1;

    constructor(
        private readonly state: AppState,
        private readonly paginationEngine: PaginationEngine
    ) {}

    public init(): void {
        this.cacheViews();

        this.unsubscribe = this.state.subscribe((newState) => {
            this.render(newState);
        });

        this.render(this.state.getState());
    }

    public destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.views = [];
        this.lastChapterId = undefined;
        this.lastPageIndex = -1;
    }

    /**
     * DOM上のReaderビューを取得
     */
    private cacheViews(): void {
        const selectors = [
            '#novel-content',
            '#fullscreen-novel-content',
            '#reader-content',
        ];

        const currentPageSelectors = [
            '#preview-current-page',
            '#reader-current-page',
            '#fullscreen-preview-page-indicator span:first-child',
        ];

        const totalPageSelectors = [
            '#preview-total-pages',
            '#reader-total-pages',
        ];

        const contentElements = this.queryAllUnique(selectors);
        const currentPageElements = this.queryAllUnique(currentPageSelectors);
        const totalPageElements = this.queryAllUnique(totalPageSelectors);

        this.views = contentElements.map((content, index) => ({
            content,
            currentPage: currentPageElements[index],
            totalPages: totalPageElements[index],
        }));
    }

    /**
     * Reader全体を描画
     */
    private render(state: NovelState): void {
        const currentChapter = state.chapters.find(
            (chapter) => chapter.id === state.currentChapterId
        );

        if (!currentChapter) {
            this.clearViews();
            return;
        }

        if (!this.views.length) {
            this.cacheViews();
        }

        const pagination = this.paginationEngine.paginate(
            currentChapter.content ?? '',
            this.getContainerHeight(),
            this.getContainerWidth(),
            this.getFontSize(),
            this.getLineHeight()
        );

        const totalPages = Math.max(pagination.totalPages, 1);

        const pageIndex = this.clamp(
            state.currentPageIndex,
            0,
            totalPages - 1
        );

        const pageHtml = pagination.pages[pageIndex] ?? '';

        const chapterChanged =
            this.lastChapterId !== currentChapter.id;

        const pageChanged =
            this.lastPageIndex !== pageIndex;

        this.renderContent(
            pageHtml,
            pageIndex,
            totalPages,
            chapterChanged,
            pageChanged
        );

        this.lastChapterId = currentChapter.id;
        this.lastPageIndex = pageIndex;
    }

    /**
     * 各Readerビューへ描画
     */
    private renderContent(
        pageHtml: string,
        pageIndex: number,
        totalPages: number,
        chapterChanged: boolean,
        pageChanged: boolean
    ): void {
        this.views.forEach((view) => {
            const { content, currentPage, totalPages: totalPage } = view;

            if (chapterChanged || pageChanged) {
                content.innerHTML = pageHtml;
            }

            if (currentPage) {
                currentPage.textContent = String(pageIndex + 1);
            }

            if (totalPage) {
                totalPage.textContent = String(totalPages);
            }

            content.setAttribute(
                'data-page-index',
                String(pageIndex)
            );

            content.setAttribute(
                'data-total-pages',
                String(totalPages)
            );
        });

        this.updateGlobalIndicators(pageIndex, totalPages);
    }

    /**
     * 個別ビューに紐付いていないページインジケーターも更新
     */
    private updateGlobalIndicators(
        pageIndex: number,
        totalPages: number
    ): void {
        const currentIndicators = document.querySelectorAll(
            '#preview-current-page, ' +
            '#reader-current-page, ' +
            '#fullscreen-preview-page-indicator span:first-child'
        );

        currentIndicators.forEach((element) => {
            element.textContent = String(pageIndex + 1);
        });

        const totalIndicators = document.querySelectorAll(
            '#preview-total-pages, #reader-total-pages'
        );

        totalIndicators.forEach((element) => {
            element.textContent = String(totalPages);
        });
    }

    /**
     * Readerビューをクリア
     */
    private clearViews(): void {
        this.views.forEach((view) => {
            view.content.innerHTML = '';

            if (view.currentPage) {
                view.currentPage.textContent = '0';
            }

            if (view.totalPages) {
                view.totalPages.textContent = '0';
            }
        });

        this.lastChapterId = undefined;
        this.lastPageIndex = -1;
    }

    /**
     * ページネーション用コンテナ高さ
     *
     * 固定値を残しつつ、将来的に実DOMサイズへ移行できる構造。
     */
    private getContainerHeight(): number {
        const element =
            document.querySelector<HTMLElement>(
                '#novel-content, ' +
                '#fullscreen-novel-content, ' +
                '#reader-content'
            );

        if (element && element.clientHeight > 0) {
            return element.clientHeight;
        }

        return 600;
    }

    /**
     * ページネーション用コンテナ幅
     */
    private getContainerWidth(): number {
        const element =
            document.querySelector<HTMLElement>(
                '#novel-content, ' +
                '#fullscreen-novel-content, ' +
                '#reader-content'
            );

        if (element && element.clientWidth > 0) {
            return element.clientWidth;
        }

        return 400;
    }

    /**
     * 現在のフォントサイズを取得
     */
    private getFontSize(): number {
        const element =
            document.querySelector<HTMLElement>(
                '#novel-content, ' +
                '#fullscreen-novel-content, ' +
                '#reader-content'
            );

        if (!element) {
            return 20;
        }

        const fontSize = parseFloat(
            window.getComputedStyle(element).fontSize
        );

        return Number.isFinite(fontSize) && fontSize > 0
            ? fontSize
            : 20;
    }

    /**
     * 現在の行間を取得
     */
    private getLineHeight(): number {
        const element =
            document.querySelector<HTMLElement>(
                '#novel-content, ' +
                '#fullscreen-novel-content, ' +
                '#reader-content'
            );

        if (!element) {
            return 1.8;
        }

        const style = window.getComputedStyle(element);
        const lineHeight = style.lineHeight;

        if (lineHeight === 'normal') {
            return 1.8;
        }

        const lineHeightPx = parseFloat(lineHeight);
        const fontSize = parseFloat(style.fontSize);

        if (
            Number.isFinite(lineHeightPx) &&
            Number.isFinite(fontSize) &&
            fontSize > 0
        ) {
            return lineHeightPx / fontSize;
        }

        return 1.8;
    }

    /**
     * 要素を重複なく取得
     */
    private queryAllUnique(
        selectors: string[]
    ): HTMLElement[] {
        const elements: HTMLElement[] = [];
        const seen = new Set<HTMLElement>();

        selectors.forEach((selector) => {
            document
                .querySelectorAll<HTMLElement>(selector)
                .forEach((element) => {
                    if (!seen.has(element)) {
                        seen.add(element);
                        elements.push(element);
                    }
                });
        });

        return elements;
    }

    /**
     * 数値を範囲内に収める
     */
    private clamp(
        value: number,
        min: number,
        max: number
    ): number {
        if (!Number.isFinite(value)) {
            return min;
        }

        return Math.min(
            Math.max(value, min),
            max
        );
    }
}
