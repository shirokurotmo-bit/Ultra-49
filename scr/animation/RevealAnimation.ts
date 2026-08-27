/* =========================================================
   RevealAnimation
   縦読み小説エディタ PRO 2.0

   役割：
   「文字がぼんやり滲んで現れ、徐々に鮮明になる」

   注意：
   ・綴られる演出は扱わない
   ・文字をCanvasへ描画しない
   ・本文DOMそのものをアニメーションさせる
========================================================= */

export interface RevealAnimationOptions {
    duration?: number;

    /*
     * 滲みの強さ。
     * 0ならblurなし。
     */
    blur?: number;

    /*
     * 開始時の透明度。
     */
    fromOpacity?: number;

    /*
     * 終了時の透明度。
     */
    toOpacity?: number;

    easing?: string;

    /*
     * ページ内の各文字を少しずつ
     * 時間差で出現させる。
     */
    stagger?: number;

    /*
     * 長文時にアニメーションを
     * 自動短縮する。
     */
    maxDuration?: number;
}

export class RevealAnimation {

    private animations:
        Animation[] = [];

    private generation = 0;

    private readonly defaultOptions:
        Required<RevealAnimationOptions> = {
            duration: 900,
            blur: 5,
            fromOpacity: 0,
            toOpacity: 1,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            stagger: 8,
            maxDuration: 2200
        };


    /* =====================================================
       Play
    ====================================================== */

    public play(
        container: HTMLElement,
        options:
            RevealAnimationOptions = {}
    ): void {

        if (!container) {
            return;
        }

        /*
         * 前回のアニメーションを確実に停止。
         */

        this.stop();

        const currentGeneration =
            ++this.generation;

        const config = {
            ...this.defaultOptions,
            ...options
        };

        /*
         * ユーザーがOS側で
         * 「視覚効果を減らす」を指定している場合、
         * アニメーションを抑制する。
         */

        if (
            window.matchMedia(
                '(prefers-reduced-motion: reduce)'
            ).matches
        ) {

            container.style.opacity =
                String(config.toOpacity);

            return;
        }

        /*
         * =================================================
         * 対象文字を取得
         * =================================================
         *
         * textContentを直接アニメーションするのではなく、
         * 文字単位のspanを作る。
         *
         * ただし元DOMを破壊しないよう、
         * アニメーション専用のラッパーを使用する。
         */

        const text =
            container.textContent ?? '';

        if (!text) {
            return;
        }

        const fragment =
            document.createDocumentFragment();

        const characters =
            Array.from(text);

        for (const character of characters) {

            const span =
                document.createElement(
                    'span'
                );

            span.className =
                'reveal-character';

            /*
             * 改行はCSSだけでは
             * 意図した位置を維持しづらいため、
             * 改行文字を専用要素にする。
             */

            if (character === '\n') {

                span.className =
                    'reveal-line-break';

                span.textContent =
                    '\n';

            } else {

                span.textContent =
                    character;
            }

            /*
             * 初期状態。
             */

            span.style.opacity =
                String(
                    config.fromOpacity
                );

            span.style.filter =
                `blur(${config.blur}px)`;

            fragment.appendChild(
                span
            );
        }

        /*
         * =================================================
         * DOM置換
         * =================================================
         */

        container.replaceChildren(
            fragment
        );

        /*
         * =================================================
         * 文字量に応じた自動速度調整
         * =================================================
         */

        const characterCount =
            characters.filter(
                char =>
                    char !== '\n'
            ).length;

        const baseDuration =
            this.calculateDuration(
                characterCount,
                config.duration,
                config.maxDuration
            );

        const stagger =
            this.calculateStagger(
                characterCount,
                config.stagger,
                config.maxDuration
            );

        const spans =
            Array.from(
                container.querySelectorAll(
                    '.reveal-character'
                )
            );

        /*
         * =================================================
         * Web Animations API
         * =================================================
         */

        spans.forEach(
            (span, index) => {

                /*
                 * 長文では全文字を
                 * 独立したAnimationとして作ると
                 * Animationオブジェクトが増える。
                 *
                 * ここでは一定数を超えたら
                 * staggerを圧縮する。
                 */

                const delay =
                    index * stagger;

                const animation =
                    span.animate(
                        [
                            {
                                opacity:
                                    config.fromOpacity,

                                filter:
                                    `blur(${config.blur}px)`
                            },
                            {
                                opacity:
                                    config.toOpacity,

                                filter:
                                    'blur(0px)'
                            }
                        ],
                        {
                            duration:
                                baseDuration,

                            delay,

                            easing:
                                config.easing,

                            fill:
                                'forwards'
                        }
                    );

                this.animations.push(
                    animation
                );
            }
        );

        /*
         * 世代チェック。
         *
         * 連続ページ切替などで
         * 古いアニメーションが
         * 後からDOMを触らないようにする。
         */

        void Promise.allSettled(
            this.animations.map(
                animation =>
                    animation.finished
            )
        ).then(() => {

            if (
                currentGeneration !==
                this.generation
            ) {
                return;
            }

            this.animations = [];
        });
    }


    /* =====================================================
       Duration
    ====================================================== */

    private calculateDuration(
        characterCount: number,
        baseDuration: number,
        maxDuration: number
    ): number {

        /*
         * 短文：
         * 通常速度
         *
         * 中程度：
         * 少し短縮
         *
         * 長文：
         * 大幅短縮
         *
         * 何千文字あっても
         * 永遠に終わらない仕様にはしない。
         */

        if (characterCount <= 100) {
            return baseDuration;
        }

        if (characterCount <= 500) {
            return Math.max(
                500,
                baseDuration * 0.85
            );
        }

        if (characterCount <= 1000) {
            return Math.max(
                400,
                baseDuration * 0.7
            );
        }

        if (characterCount <= 3000) {
            return Math.max(
                300,
                baseDuration * 0.55
            );
        }

        return Math.max(
            220,
            Math.min(
                baseDuration,
                maxDuration /
                    Math.max(
                        1,
                        Math.log10(
                            characterCount
                        )
                    )
            )
        );
    }


    /* =====================================================
       Stagger
    ====================================================== */

    private calculateStagger(
        characterCount: number,
        baseStagger: number,
        maxDuration: number
    ): number {

        if (
            characterCount <= 100
        ) {
            return baseStagger;
        }

        if (
            characterCount <= 500
        ) {
            return baseStagger * 0.7;
        }

        if (
            characterCount <= 1000
        ) {
            return baseStagger * 0.45;
        }

        if (
            characterCount <= 3000
        ) {
            return baseStagger * 0.2;
        }

        /*
         * 長文ではほぼ同時に現れる。
         *
         * 「演出のために30秒待たされる」
         * という本末転倒を防ぐ。
         */

        return Math.min(
            1,
            maxDuration /
                Math.max(
                    1,
                    characterCount
                )
        );
    }


    /* =====================================================
       Stop
    ====================================================== */

    public stop(): void {

        this.generation++;

        for (
            const animation
            of this.animations
        ) {
            animation.cancel();
        }

        this.animations = [];
    }


    /* =====================================================
       Destroy
    ====================================================== */

    public destroy(): void {
        this.stop();
    }
}
