import { AppState } from '../app/AppState';
import {
    PaginationEngine,
    PaginationOptions,
    PaginationResult,
} from '../pagination/PaginationEngine';

type NovelState = Readonly<
    import('../app/AppState').NovelState
>;

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

    private lastPaginationKey = '';

    constructor(
        private readonly state: AppState,
        private readonly paginationEngine: PaginationEngine
    ) {}

    public init(): void {
        this.cacheViews();

        this.unsubscribe = this.state.subscribe(
            (newState) => {
                this.render(newState);
            }
        );

        this.render(this.state.getState());
    }

    public destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;

        this.views = [];

        this.lastChapterId = undefined;
        this.lastPageIndex = -1;
        this.lastPaginationKey = '';

    }

    /**
     * Reader関連DOMを再取得する。
     *
     * モード切替やfullscreen生成後にも呼び出せる。
     */
    public refreshViews(): void {
        this.cacheViews();

        this.lastPaginationKey = '';

        this.render(this.state.getState());
    }

    /**
     * 現在ページを強制再描画する。
     */
    public refresh(): void {
        this.lastPaginationKey = '';
        this.lastPageIndex = -1;

        this.render(this.state.getState());
    }

    /**
     * ReaderビューのDOMを取得。
     */
    private cacheViews(): void {
        const contentSelectors = [
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

        const contentElements =
            this.queryAllUnique(
                contentSelectors
            );

        const currentPageElements =
            this.queryAllUnique(
                currentPageSelectors
            );

        const totalPageElements =
            this.queryAllUnique(
                totalPageSelectors
            );

        this.views = contentElements.map(
            (content, index) => ({
                content,
                currentPage:
                    currentPageElements[index],
                totalPages:
                    totalPageElements[index],
            })
        );
    }

    /**
     * メイン描画。
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
            this.clearViews();
            return;
        }

        if (this.views.length === 0) {
            this.cacheViews();
        }

        const primaryContent =
            this.getPrimaryContent();

        if (!primaryContent) {
            return;
        }

        const metrics =
            this.getContainerMetrics(
                primaryContent
            );

        const paginationOptions =
            this.getPaginationOptions(
                primaryContent
            );

        const paginationKey =
            this.createPaginationKey(
                currentChapter.id,
                currentChapter.content ?? '',
                metrics,
                paginationOptions
            );

        let result:
            PaginationResult;

        /*
         * レイアウト条件が変わっていない場合は
         * 毎回ページネーションを実行しない。
         *
         * AppStateのページ番号変更だけなら
         * 既存結果を使う。
         */
        if (
            paginationKey ===
            this.lastPaginationKey &&
            this.cachedResult
        ) {
            result = this.cachedResult;
        } else {
            result =
                this.paginationEngine.paginate(
                    currentChapter.content ?? '',
                    metrics.height,
                    metrics.width,
                    metrics.fontSize,
                    metrics.lineHeight,
                    paginationOptions
                );

            this.cachedResult = result;
            this.lastPaginationKey =
                paginationKey;
        }

        const totalPages =
            Math.max(
                1,
                result.totalPages
            );

        const pageIndex =
            this.clamp(
                state.currentPageIndex,
                0,
                totalPages - 1
            );

        const page =
            result.pageData[pageIndex];

        const pageHtml =
            page?.html ??
            result.pages[pageIndex] ??
            '';

        const chapterChanged =
            this.lastChapterId !==
            currentChapter.id;

        const pageChanged =
            this.lastPageIndex !==
            pageIndex;

        this.renderViews(
            pageHtml,
            pageIndex,
            totalPages,
            page,
            chapterChanged,
            pageChanged
        );

        this.lastChapterId =
            currentChapter.id;

        this.lastPageIndex =
            pageIndex;
    }

    /**
     * 最終ページネーション結果。
     *
     * ページ番号だけが変わった場合の
     * 再計算を防ぐ。
     */
    private cachedResult?:
        PaginationResult;

    /**
     * 実際に表示されている主要Readerを取得。
     */
    private getPrimaryContent():
        HTMLElement | null {
        const selectors = [
            '#reader-content',
            '#novel-content',
            '#fullscreen-novel-content',
        ];

        for (
            const selector of selectors
        ) {
            const element =
                document.querySelector<HTMLElement>(
                    selector
                );

            if (
                element &&
                element.clientWidth > 0 &&
                element.clientHeight > 0
            ) {
                return element;
            }
        }

        return (
            document.querySelector<HTMLElement>(
                selectors[0]
            ) ??
            document.querySelector<HTMLElement>(
                selectors[1]
            ) ??
            document.querySelector<HTMLElement>(
                selectors[2]
            )
        );
    }

    /**
     * 実DOMからページサイズを取得。
     */
    private getContainerMetrics(
        element: HTMLElement
    ): {
        width: number;
        height: number;
        fontSize: number;
        lineHeight: number;
    } {
        const style =
            window.getComputedStyle(
                element
            );

        const width =
            element.clientWidth ||
            parseFloat(style.width) ||
            400;

        const height =
            element.clientHeight ||
            parseFloat(style.height) ||
            600;

        const fontSizeValue =
            parseFloat(style.fontSize);

        const fontSize =
            Number.isFinite(fontSizeValue) &&
            fontSizeValue > 0
                ? fontSizeValue
                : 20;

        let lineHeight =
            1.8;

        if (
            style.lineHeight !==
            'normal'
        ) {
            const lineHeightValue =
                parseFloat(
                    style.lineHeight
                );

            if (
                Number.isFinite(
                    lineHeightValue
                )
            ) {
                /*
                 * CSSのline-heightがpxの場合は
                 * font-size基準の倍率へ変換。
                 */
                if (
                    style.lineHeight.endsWith(
                        'px'
                    )
                ) {
                    lineHeight =
                        lineHeightValue /
                        fontSize;
                } else {
                    lineHeight =
                        lineHeightValue;
                }
            }
        }

        return {
            width: Math.max(
                1,
                Math.floor(width)
            ),
            height: Math.max(
                1,
                Math.floor(height)
            ),
            fontSize,
            lineHeight:
                Math.max(
                    1,
                    lineHeight
                ),
        };
    }

    /**
     * PaginationEngineへ渡す設定。
     *
     * 実際のReaderと測定DOMの条件を
     * できるだけ一致させる。
     */
    private getPaginationOptions(
        element: HTMLElement
    ): PaginationOptions {
        const style =
            window.getComputedStyle(
                element
            );

        return {
            fontFamily:
                style.fontFamily,

            fontSize:
                parseFloat(
                    style.fontSize
                ) || 20,

            lineHeight:
                this.resolveLineHeight(
                    style
                ),

            paddingTop:
                this.getPadding(
                    style.paddingTop,
                    32
                ),

            paddingRight:
                this.getPadding(
                    style.paddingRight,
                    40
                ),

            paddingBottom:
                this.getPadding(
                    style.paddingBottom,
                    32
                ),

            paddingLeft:
                this.getPadding(
                    style.paddingLeft,
                    40
                ),

            minimumCharactersPerPage:
                80,

            maximumCharactersPerPage:
                10000,
        };
    }

    /**
     * CSS paddingを数値化。
     */
    private getPadding(
        value: string,
        fallback: number
    ): number {
        const parsed =
            parseFloat(value);

        return Number.isFinite(parsed)
            ? Math.max(0, parsed)
            : fallback;
    }

    /**
     * line-heightを倍率へ変換。
     */
    private resolveLineHeight(
        style: CSSStyleDeclaration
    ): number {
        const fontSize =
            parseFloat(
                style.fontSize
            ) || 20;

        if (
            style.lineHeight ===
            'normal'
        ) {
            return 1.8;
        }

        const value =
            parseFloat(
                style.lineHeight
            );

        if (
            !Number.isFinite(value)
        ) {
            return 1.8;
        }

        if (
            style.lineHeight.endsWith(
                'px'
            )
        ) {
            return Math.max(
                1,
                value / fontSize
            );
        }

        return Math.max(
            1,
            value
        );
    }

    /**
     * ページ内容を各ビューへ反映。
     */
    private renderViews(
        pageHtml: string,
        pageIndex: number,
        totalPages: number,
        page:
            | import('../pagination/PaginationEngine').PaginationPage
            | undefined,
        chapterChanged: boolean,
        pageChanged: boolean
    ): void {
        this.views.forEach(
            (view) => {
                /*
                 * ページが変わったときだけ本文を書き換える。
                 */
                if (
                    chapterChanged ||
                    pageChanged
                ) {
                    view.content.innerHTML =
                        pageHtml;
                }

                if (
                    view.currentPage
                ) {
                    view.currentPage.textContent =
                        String(
                            pageIndex + 1
                        );
                }

                if (
                    view.totalPages
                ) {
                    view.totalPages.textContent =
                        String(
                            totalPages
                        );
                }

                /*
                 * CSS / RevealAnimation / TouchController
                 * から現在ページを参照できるようにする。
                 */
                view.content.dataset.pageIndex =
                    String(pageIndex);

                view.content.dataset.totalPages =
                    String(totalPages);

                if (page) {
                    view.content.dataset.startOffset =
                        String(
                            page.startOffset
                        );

                    view.content.dataset.endOffset =
                        String(
                            page.endOffset
                        );

                    view.content.dataset.characterCount =
                        String(
                            page.characterCount
                        );
                }
            }
        );

        this.updateGlobalIndicators(
            pageIndex,
            totalPages
        );
    }

    /**
     * 共通ページインジケーター更新。
     */
    private updateGlobalIndicators(
        pageIndex: number,
        totalPages: number
    ): void {
        const currentIndicators =
            document.querySelectorAll(
                '#preview-current-page, ' +
                '#reader-current-page, ' +
                '#fullscreen-preview-page-indicator span:first-child'
            );

        currentIndicators.forEach(
            (element) => {
                element.textContent =
                    String(
                        pageIndex + 1
                    );
            }
        );

        const totalIndicators =
            document.querySelectorAll(
                '#preview-total-pages, ' +
                '#reader-total-pages'
            );

        totalIndicators.forEach(
            (element) => {
                element.textContent =
                    String(
                        totalPages
                    );
            }
        );
    }

    /**
     * Readerビューをクリア。
     */
    private clearViews(): void {
        this.views.forEach(
            (view) => {
                view.content.innerHTML =
                    '';

                if (
                    view.currentPage
                ) {
                    view.currentPage.textContent =
                        '0';
                }

                if (
                    view.totalPages
                ) {
                    view.totalPages.textContent =
                        '0';
                }

                delete view.content.dataset
                    .pageIndex;

                delete view.content.dataset
                    .totalPages;

                delete view.content.dataset
                    .startOffset;

                delete view.content.dataset
                    .endOffset;

                delete view.content.dataset
                    .characterCount;
            }
        );

        this.cachedResult =
            undefined;

        this.lastChapterId =
            undefined;

        this.lastPageIndex =
            -1;

        this.lastPaginationKey =
            '';
    }

    /**
     * ページネーション条件を一意にする。
     */
    private createPaginationKey(
        chapterId: string,
        text: string,
        metrics: {
            width: number;
            height: number;
            fontSize: number;
            lineHeight: number;
        },
        options: PaginationOptions
    ): string {
        return JSON.stringify({
            chapterId,
            text,
            width: metrics.width,
            height: metrics.height,
            fontSize: metrics.fontSize,
            lineHeight:
                metrics.lineHeight,
            fontFamily:
                options.fontFamily,
            paddingTop:
                options.paddingTop,
            paddingRight:
                options.paddingRight,
            paddingBottom:
                options.paddingBottom,
            paddingLeft:
                options.paddingLeft,
        });
    }

    /**
     * 重複なしでDOM要素を取得。
     */
    private queryAllUnique(
        selectors: string[]
    ): HTMLElement[] {
        const result: HTMLElement[] =
            [];

        const seen =
            new Set<HTMLElement>();

        selectors.forEach(
            (selector) => {
                document
                    .querySelectorAll<HTMLElement>(
                        selector
                    )
                    .forEach(
                        (element) => {
                            if (
                                !seen.has(
                                    element
                                )
                            ) {
                                seen.add(
                                    element
                                );

                                result.push(
                                    element
                                );
                            }
                        }
                    );
            }
        );

        return result;
    }

    /**
     * 数値を範囲内に収める。
     */
    private clamp(
        value: number,
        min: number,
        max: number
    ): number {
        if (
            !Number.isFinite(value)
        ) {
            return min;
        }

        return Math.min(
            Math.max(
                value,
                min
            ),
            max
        );
    }
}
