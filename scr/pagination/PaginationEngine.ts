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
     * DOM測定時に最低限確保する文字数。
     * 極端に短いページを防ぐための補助値。
     */
    minimumCharactersPerPage?: number;

    /*
     * 1ページあたりの最大文字数。
     *
     * DOM計測が異常になった場合の安全弁。
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
     * 将来的にReaderControllerが
     * ページ位置を正確に管理できるように
     * 詳細情報も返す。
     */
    pageData: PaginationPage[];

    characterCount: number;
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
    ====================================================== */

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
         * 空作品
         */

        if (normalizedText.length === 0) {
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
         * DOMが利用できない環境では
         * 安全なfallbackを使用する。
         *
         * テスト環境やSSR対策。
         */

        if (
            typeof document === 'undefined'
        ) {
            return this.paginateFallback(
                normalizedText,
                containerHeight,
                containerWidth,
                fontSize,
                lineHeight
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
                Math.max(1, pages.length),

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
    ====================================================== */

    private paginateByDOM(
        text: string,
        config: Required<PaginationOptions> & {
            width: number;
            height: number;
        }
    ): PaginationPage[] {

        const characters =
            Array.from(text);

        const totalCharacters =
            characters.length;

        const pages: PaginationPage[] = [];

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
             * 残り全部が入るなら、
             * 無駄な二分探索をしない。
             */

            if (
                this.fits(
                    text.slice(
                        currentOffset
                    ),
                    config
                )
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
             * 「何文字目まで入るか」を探す。
             *
             * 線形探索で1文字ずつ追加すると、
             * 長編では測定回数が爆発する。
             */

            let low = 1;
            let high = remaining;

            let bestFit = 0;

            while (low <= high) {

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

                    bestFit = middle;
                    low = middle + 1;

                } else {

                    high = middle - 1;
                }
            }

            /*
             * 最低1文字は進める。
             *
             * 異常なCSSや極端に小さい画面でも
             * 無限ループしない。
             */

            if (bestFit <= 0) {
                bestFit = 1;
            }

            /*
             * =================================================
             * 改行位置の最適化
             * =================================================
             *
             * ページ末尾が段落途中になる場合、
             * 可能なら直前の改行位置まで戻す。
             *
             * ただし戻しすぎてページが極端に短くなる
             * 場合はDOM測定結果を優先する。
             */

            bestFit =
                this.optimizeBreakPosition(
                    characters,
                    currentOffset,
                    bestFit,
                    config
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
             * 万が一空文字になった場合の
             * 無限ループ防止。
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

        return pages.length > 0
            ? pages
            : [{
                index: 0,
                text: '',
                html: '',
                startOffset: 0,
                endOffset: 0,
                characterCount: 0
            }];
    }


    /* =====================================================
       Fit Test
    ====================================================== */

    private fits(
        text: string,
        config: Required<PaginationOptions> & {
            width: number;
            height: number;
        }
    ): boolean {

        const element =
            this.getMeasurementElement(
                config
            );

        element.textContent =
            text;

        /*
         * offsetWidth / offsetHeightではなく、
         * scrollWidth / scrollHeightを見る。
         *
         * 縦書きではブラウザ内部で
         * width方向へ列が増えるため、
         * 両方を確認する。
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
    ====================================================== */

    private getMeasurementElement(
        config: Required<PaginationOptions> & {
            width: number;
            height: number;
        }
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

        if (
            this.measurementElement &&
            this.lastMeasurementKey === key
        ) {
            return this.measurementElement;
        }

        if (
            this.measurementElement
        ) {
            this.measurementElement.remove();
        }

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

                width: `${config.width}px`,
                height: `${config.height}px`,

                /*
                 * 実際の本文と同じ縦書き。
                 */
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
    ====================================================== */

    private optimizeBreakPosition(
        characters: string[],
        start: number,
        length: number,
        config: Required<PaginationOptions> & {
            width: number;
            height: number;
        }
    ): number {

        const minimum =
            config.minimumCharactersPerPage;

        /*
         * ページが短すぎる場合は
         * 無理に改行位置へ戻さない。
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
         * 直近の段落改行を探す。
         */

        for (
            let i =
                candidate.length - 1;
            i >= Math.max(
                minimum,
                candidate.length - 120
            );
            i--
        ) {

            if (
                candidate[i] === '\n'
            ) {

                const breakLength =
                    i + 1;

                if (
                    breakLength <
                    minimum
                ) {
                    break;
                }

                const breakText =
                    characters
                        .slice(
                            start,
                            start +
                                breakLength
                        )
                        .join('');

                if (
                    this.fits(
                        breakText,
                        config
                    )
                ) {
                    return breakLength;
                }
            }
        }

        return length;
    }


    /* =====================================================
       Page Creation
    ====================================================== */

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
             * 本文は必ずescapeしてからHTML化。
             *
             * ユーザーが小説内にHTMLを書いても
             * DOMとして実行されない。
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
    ====================================================== */

    private createConfig(
        height: number,
        width: number,
        fontSize: number,
        lineHeight: number,
        options: PaginationOptions
    ) {

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
                    fontSize
                ),

            lineHeight:
                Math.max(
                    1,
                    lineHeight
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
                Math.max(
                    1,
                    options.minimumCharactersPerPage ??
                    80
                ),

            maximumCharactersPerPage:
                Math.max(
                    100,
                    options.maximumCharactersPerPage ??
                    10000
                )
        };
    }


    /* =====================================================
       Normalize
    ====================================================== */

    private normalizeText(
        text: string
    ): string {

        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\u00a0/g, ' ');
    }


    /* =====================================================
       Fallback
    ====================================================== */

    private paginateFallback(
        text: string,
        containerHeight: number,
        containerWidth: number,
        fontSize: number,
        lineHeight: number
    ): PaginationResult {

        const chars =
            Array.from(text);

        const charsPerLine =
            Math.max(
                1,
                Math.floor(
                    containerHeight /
                    fontSize
                )
            );

        const linesPerPage =
            Math.max(
                1,
                Math.floor(
                    containerWidth /
                    (
                        fontSize *
                        lineHeight
                    )
                )
            );

        const estimatedCapacity =
            Math.max(
                1,
                charsPerLine *
                linesPerPage
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
                    estimatedCapacity
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

            offset = end;
            index++;
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
    ====================================================== */

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
    ====================================================== */

    public destroy(): void {

        this.measurementElement?.remove();

        this.measurementElement =
            null;

        this.lastMeasurementKey =
            '';
    }
}
