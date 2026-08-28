/* =========================================================
   PaginationEngine
   縦書き小説エディタ PRO 2.0
========================================================= */

export interface PaginationOptions {
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;

    /*
     * ページ内に確保する余白。
     * 実際のbook-pageのpaddingと一致させる。
     */
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;

    /*
     * 極端に短いページを防ぐための補助値。
     */
    minimumCharactersPerPage?: number;

    /*
     * 1ページあたりの最大文字数。
     *
     * DOM測定が異常になった場合の安全弁。
     */
    maximumCharactersPerPage?: number;
}


export interface PaginationPage {
    index: number;
    text: string;
    html: string;

    startOffset: number;
    endOffset: number;

    characterCount: number;
}


export interface PaginationResult {
    pages: string[];
    totalPages: number;

    /*
     * ReaderControllerがページ位置・文字位置を
     * 正確に管理できるよう詳細情報も返す。
     */
    pageData: PaginationPage[];

    characterCount: number;
}


/* =========================================================
   Internal Types
========================================================= */

interface PaginationConfig
    extends Required<PaginationOptions> {
    width: number;
    height: number;
}


/* =========================================================
   Engine
========================================================= */

export class PaginationEngine {

    private measurementElement:
        HTMLDivElement | null = null;

    private lastMeasurementKey = '';


    /* =====================================================
       Public
    ===================================================== */

    public paginate(
        text: string,
        containerHeight: number,
        containerWidth: number,
        fontSize: number,
        lineHeight: number,
        options: PaginationOptions = {}
    ): PaginationResult {

        const normalizedText =
            this.normalizeText(text);

        /*
         * 空作品。
         *
         * Reader側では1ページ目を表示できる状態を
         * 維持する。
         */
        if (
            normalizedText.length === 0
        ) {
            return {
                pages: [''],
                totalPages: 1,

                pageData: [{
                    index: 0,
                    text: '',
                    html: '',
                    startOffset: 0,
                    endOffset: 0,
                    characterCount: 0
                }],

                characterCount: 0
            };
        }

        /*
         * DOMが存在しない環境ではfallback。
         *
         * テスト、SSR、Node環境などに対応。
         */
        if (
            typeof document === 'undefined'
        ) {
            return this.paginateFallback(
                normalizedText,
                containerHeight,
                containerWidth,
                fontSize,
                lineHeight,
                options
            );
        }

        const config =
            this.createConfig(
                containerHeight,
                containerWidth,
                fontSize,
                lineHeight,
                options
            );

        const pages =
            this.paginateByDOM(
                normalizedText,
                config
            );

        return {
            pages:
                pages.map(
                    page => page.html
                ),

            totalPages:
                Math.max(
                    1,
                    pages.length
                ),

            pageData:
                pages,

            characterCount:
                Array.from(
                    normalizedText
                ).length
        };
    }


    /* =====================================================
       DOM Pagination
    ===================================================== */

    private paginateByDOM(
        text: string,
        config: PaginationConfig
    ): PaginationPage[] {

        const characters =
            Array.from(text);

        const totalCharacters =
            characters.length;

        const pages:
            PaginationPage[] = [];

        let currentOffset = 0;
        let pageIndex = 0;

        while (
            currentOffset <
            totalCharacters
        ) {

            const remaining =
                totalCharacters -
                currentOffset;

            /*
             * まず「残り全部」が1ページに入るか確認。
             */
            if (
                this.fits(
                    text.slice(
                        currentOffset
                    ),
                    config
                ) &&
                remaining <=
                    config.maximumCharactersPerPage
            ) {

                const pageText =
                    text.slice(
                        currentOffset
                    );

                pages.push(
                    this.createPage(
                        pageIndex,
                        pageText,
                        currentOffset,
                        totalCharacters
                    )
                );

                break;
            }

            /*
             * =================================================
             * 二分探索
             * =================================================
             *
             * 最大文字数を探索上限にする。
             *
             * maximumCharactersPerPageを設定していても
             * 探索に使っていない問題を修正。
             */
            let low = 1;

            let high =
                Math.min(
                    remaining,
                    config.maximumCharactersPerPage
                );

            let bestFit = 0;

            while (
                low <= high
            ) {

                const middle =
                    Math.floor(
                        (low + high) / 2
                    );

                const candidate =
                    characters
                        .slice(
                            currentOffset,
                            currentOffset +
                                middle
                        )
                        .join('');

                if (
                    this.fits(
                        candidate,
                        config
                    )
                ) {

                    bestFit =
                        middle;

                    low =
                        middle + 1;

                } else {

                    high =
                        middle - 1;
                }
            }

            /*
             * DOM測定上、1文字も収まらない場合でも
             * 必ず1文字だけ進める。
             */
            if (
                bestFit <= 0
            ) {
                bestFit = 1;
            }

            /*
             * maximumCharactersPerPageを
             * 必ず超えないようにする。
             */
            bestFit =
                Math.min(
                    bestFit,
                    config.maximumCharactersPerPage,
                    remaining
                );

            /*
             * ページ末尾を可能な限り
             * 段落の切れ目へ寄せる。
             */
            bestFit =
                this.optimizeBreakPosition(
                    characters,
                    currentOffset,
                    bestFit,
                    config
                );

            /*
             * 最適化後も安全のため上限を再適用。
             */
            bestFit =
                Math.min(
                    Math.max(
                        1,
                        bestFit
                    ),
                    config.maximumCharactersPerPage,
                    remaining
                );

            const endOffset =
                Math.min(
                    totalCharacters,
                    currentOffset +
                        bestFit
                );

            const pageText =
                characters
                    .slice(
                        currentOffset,
                        endOffset
                    )
                    .join('');

            /*
             * 空文字ページによる無限ループ防止。
             */
            if (
                pageText.length === 0
            ) {
                break;
            }

            pages.push(
                this.createPage(
                    pageIndex,
                    pageText,
                    currentOffset,
                    endOffset
                )
            );

            currentOffset =
                endOffset;

            pageIndex++;
        }

        /*
         * 何らかの異常でページが生成されなかった場合。
         */
        if (
            pages.length === 0
        ) {
            return [{
                index: 0,
                text: '',
                html: '',
                startOffset: 0,
                endOffset: 0,
                characterCount: 0
            }];
        }

        return pages;
    }


    /* =====================================================
       Fit Test
    ===================================================== */

    private fits(
        text: string,
        config: PaginationConfig
    ): boolean {

        const element =
            this.getMeasurementElement(
                config
            );

        /*
         * textContentを使用することで
         * ユーザー本文がHTMLとして解釈されない。
         */
        element.textContent =
            text;

        /*
         * 縦書きでは列方向と行方向の双方で
         * overflowが発生する可能性があるため、
         * width / heightの両方を見る。
         */
        const fitsWidth =
            element.scrollWidth <=
            element.clientWidth + 1;

        const fitsHeight =
            element.scrollHeight <=
            element.clientHeight + 1;

        return (
            fitsWidth &&
            fitsHeight
        );
    }


    /* =====================================================
       Measurement Element
    ===================================================== */

    private getMeasurementElement(
        config: PaginationConfig
    ): HTMLDivElement {

        const key = [
            config.width,
            config.height,
            config.fontFamily,
            config.fontSize,
            config.lineHeight,
            config.paddingTop,
            config.paddingRight,
            config.paddingBottom,
            config.paddingLeft
        ].join('|');

        /*
         * CSS条件が同一なら測定DOMを再利用。
         */
        if (
            this.measurementElement &&
            this.lastMeasurementKey === key
        ) {
            return this.measurementElement;
        }

        /*
         * レイアウト条件が変化した場合は
         * 古い測定DOMを破棄。
         */
        this.measurementElement?.remove();

        const element =
            document.createElement(
                'div'
            );

        element.setAttribute(
            'aria-hidden',
            'true'
        );

        Object.assign(
            element.style,
            {
                position: 'fixed',

                left: '-100000px',

                top: '0',

                width:
                    `${config.width}px`,

                height:
                    `${config.height}px`,

                writingMode:
                    'vertical-rl',

                textOrientation:
                    'mixed',

                whiteSpace:
                    'pre-wrap',

                overflowWrap:
                    'break-word',

                wordBreak:
                    'normal',

                fontFamily:
                    config.fontFamily,

                fontSize:
                    `${config.fontSize}px`,

                lineHeight:
                    String(
                        config.lineHeight
                    ),

                paddingTop:
                    `${config.paddingTop}px`,

                paddingRight:
                    `${config.paddingRight}px`,

                paddingBottom:
                    `${config.paddingBottom}px`,

                paddingLeft:
                    `${config.paddingLeft}px`,

                boxSizing:
                    'border-box',

                visibility:
                    'hidden',

                pointerEvents:
                    'none',

                overflow:
                    'visible',

                contain:
                    'layout style paint'
            }
        );

        document.body.appendChild(
            element
        );

        this.measurementElement =
            element;

        this.lastMeasurementKey =
            key;

        return element;
    }


    /* =====================================================
       Break Optimization
    ===================================================== */

    private optimizeBreakPosition(
        characters: string[],
        start: number,
        length: number,
        config: PaginationConfig
    ): number {

        const minimum =
            Math.min(
                config.minimumCharactersPerPage,
                length
            );

        /*
         * 短いページでは無理に改行位置へ
         * 戻さない。
         */
        if (
            length <= minimum
        ) {
            return length;
        }

        const candidate =
            characters.slice(
                start,
                start + length
            );

        /*
         * 直近120文字程度の中から、
         * もっとも近い段落改行を探す。
         */
        const searchStart =
            Math.max(
                minimum,
                candidate.length - 120
            );

        for (
            let i =
                candidate.length - 1;
            i >= searchStart;
            i--
        ) {

            if (
                candidate[i] !== '\n'
            ) {
                continue;
            }

            const breakLength =
                i + 1;

            if (
                breakLength < minimum
            ) {
                continue;
            }

            if (
                breakLength >
                config.maximumCharactersPerPage
            ) {
                continue;
            }

            const breakText =
                characters
                    .slice(
                        start,
                        start +
                            breakLength
                    )
                    .join('');

            /*
             * 実際に収まるか再確認。
             */
            if (
                this.fits(
                    breakText,
                    config
                )
            ) {
                return breakLength;
            }
        }

        return length;
    }


    /* =====================================================
       Page Creation
    ===================================================== */

    private createPage(
        index: number,
        text: string,
        startOffset: number,
        endOffset: number
    ): PaginationPage {

        return {
            index,

            text,

            /*
             * escapeHtml()済みなので、
             * ユーザー本文がHTMLとして実行されない。
             */
            html:
                `<div class="novel-page-text">${this.escapeHtml(text)}</div>`,

            startOffset,

            endOffset,

            characterCount:
                Array.from(text).length
        };
    }


    /* =====================================================
       Configuration
    ===================================================== */

    private createConfig(
        height: number,
        width: number,
        fontSize: number,
        lineHeight: number,
        options: PaginationOptions
    ): PaginationConfig {

        const safeMaximum =
            Math.max(
                100,
                Math.floor(
                    options.maximumCharactersPerPage ??
                    10000
                )
            );

        const safeMinimum =
            Math.max(
                1,
                Math.floor(
                    options.minimumCharactersPerPage ??
                    80
                )
            );

        return {
            width:
                Math.max(
                    1,
                    Math.floor(width)
                ),

            height:
                Math.max(
                    1,
                    Math.floor(height)
                ),

            fontFamily:
                options.fontFamily ??
                '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, serif',

            fontSize:
                Math.max(
                    8,
                    Number.isFinite(fontSize)
                        ? fontSize
                        : 20
                ),

            lineHeight:
                Math.max(
                    1,
                    Number.isFinite(lineHeight)
                        ? lineHeight
                        : 1.8
                ),

            paddingTop:
                Math.max(
                    0,
                    options.paddingTop ?? 32
                ),

            paddingRight:
                Math.max(
                    0,
                    options.paddingRight ?? 40
                ),

            paddingBottom:
                Math.max(
                    0,
                    options.paddingBottom ?? 32
                ),

            paddingLeft:
                Math.max(
                    0,
                    options.paddingLeft ?? 40
                ),

            minimumCharactersPerPage:
                Math.min(
                    safeMinimum,
                    safeMaximum
                ),

            maximumCharactersPerPage:
                safeMaximum
        };
    }


    /* =====================================================
       Normalize
    ===================================================== */

    private normalizeText(
        text: string
    ): string {

        return String(text)
            .replace(
                /\r\n/g,
                '\n'
            )
            .replace(
                /\r/g,
                '\n'
            )
            .replace(
                /\u00a0/g,
                ' '
            );
    }


    /* =====================================================
       Fallback
    ===================================================== */

    private paginateFallback(
        text: string,
        containerHeight: number,
        containerWidth: number,
        fontSize: number,
        lineHeight: number,
        options: PaginationOptions
    ): PaginationResult {

        const chars =
            Array.from(text);

        const safeFontSize =
            Math.max(
                8,
                Number.isFinite(fontSize)
                    ? fontSize
                    : 20
            );

        const safeLineHeight =
            Math.max(
                1,
                Number.isFinite(lineHeight)
                    ? lineHeight
                    : 1.8
            );

        const charsPerLine =
            Math.max(
                1,
                Math.floor(
                    Math.max(
                        1,
                        containerHeight
                    ) /
                    safeFontSize
                )
            );

        const linesPerPage =
            Math.max(
                1,
                Math.floor(
                    Math.max(
                        1,
                        containerWidth
                    ) /
                    (
                        safeFontSize *
                        safeLineHeight
                    )
                )
            );

        const estimatedCapacity =
            Math.max(
                1,
                charsPerLine *
                linesPerPage
            );

        const maximumCharactersPerPage =
            Math.max(
                100,
                Math.floor(
                    options.maximumCharactersPerPage ??
                    10000
                )
            );

        const capacity =
            Math.min(
                estimatedCapacity,
                maximumCharactersPerPage
            );

        const pages:
            PaginationPage[] = [];

        let offset = 0;
        let index = 0;

        while (
            offset <
            chars.length
        ) {

            const end =
                Math.min(
                    chars.length,
                    offset +
                        capacity
                );

            const pageText =
                chars
                    .slice(
                        offset,
                        end
                    )
                    .join('');

            pages.push(
                this.createPage(
                    index,
                    pageText,
                    offset,
                    end
                )
            );

            offset =
                end;

            index++;
        }

        /*
         * 通常は空にならないが、
         * 安全のため1ページを保証。
         */
        if (
            pages.length === 0
        ) {
            pages.push(
                this.createPage(
                    0,
                    '',
                    0,
                    0
                )
            );
        }

        return {
            pages:
                pages.map(
                    page =>
                        page.html
                ),

            totalPages:
                Math.max(
                    1,
                    pages.length
                ),

            pageData:
                pages,

            characterCount:
                chars.length
        };
    }


    /* =====================================================
       Escape
    ===================================================== */

    private escapeHtml(
        value: string
    ): string {

        return value
            .replace(
                /&/g,
                '&amp;'
            )
            .replace(
                /</g,
                '&lt;'
            )
            .replace(
                />/g,
                '&gt;'
            )
            .replace(
                /"/g,
                '&quot;'
            )
            .replace(
                /'/g,
                '&#039;'
            );
    }


    /* =====================================================
       Cleanup
    ===================================================== */

    public destroy(): void {

        this.measurementElement?.remove();

        this.measurementElement =
            null;

        this.lastMeasurementKey =
            '';
    }
}
