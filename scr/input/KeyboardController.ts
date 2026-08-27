/* =========================================================
   KeyboardController
   縦読み小説エディタ PRO 2.0

   責務：
   ・キーボード入力の監視
   ・ショートカットの判定
   ・入力イベントの正規化
   ・対応するcallbackの呼び出し

   やらないこと：
   ・ページ状態の変更
   ・モード変更
   ・保存処理
   ・DOMの直接操作
========================================================= */

export interface KeyboardEventHandlers {
    onSave?: () => void;

    onEscape?: () => void;

    onNextPage?: () => void;

    onPrevPage?: () => void;

    onTogglePreview?: () => void;
}

export interface KeyboardControllerOptions {
    /*
     * 執筆中でもページ移動キーを有効にするか。
     *
     * デフォルトはfalse。
     * 執筆中のArrowLeft / ArrowRightを
     * ブラウザのカーソル操作として残す。
     */
    allowPageNavigationInEditor?: boolean;

    /*
     * PageUp / PageDownを
     * 入力欄でもページ移動に使用するか。
     *
     * デフォルトfalse。
     */
    allowPageNavigationInInputs?: boolean;

    /*
     * 読書モード時にSpaceで次ページへ進む。
     */
    enableSpaceNavigation?: boolean;

    /*
     * F11などブラウザ標準操作には触れない。
     */
}

type NormalizedKey =
    | 'save'
    | 'escape'
    | 'next-page'
    | 'prev-page'
    | 'toggle-preview'
    | null;


export class KeyboardController {

    private readonly handler:
        (event: KeyboardEvent) => void;

    private initialized = false;

    private readonly options:
        Required<KeyboardControllerOptions>;

    constructor(
        private readonly callbacks:
            KeyboardEventHandlers,

        options:
            KeyboardControllerOptions = {}
    ) {

        this.options = {
            allowPageNavigationInEditor:
                options.allowPageNavigationInEditor ??
                false,

            allowPageNavigationInInputs:
                options.allowPageNavigationInInputs ??
                false,

            enableSpaceNavigation:
                options.enableSpaceNavigation ??
                true
        };

        this.handler =
            (event: KeyboardEvent) => {
                this.handleKeyDown(event);
            };
    }


    /* =====================================================
       Lifecycle
    ====================================================== */

    public init(): void {

        if (this.initialized) {
            return;
        }

        window.addEventListener(
            'keydown',
            this.handler,
            {
                passive: false
            }
        );

        this.initialized = true;
    }


    public destroy(): void {

        if (!this.initialized) {
            return;
        }

        window.removeEventListener(
            'keydown',
            this.handler
        );

        this.initialized = false;
    }


    /* =====================================================
       Main
    ====================================================== */

    private handleKeyDown(
        event: KeyboardEvent
    ): void {

        /*
         * IME変換中はショートカットを
         * 一切奪わない。
         *
         * 日本語入力では非常に重要。
         */

        if (
            event.isComposing ||
            event.key === 'Process'
        ) {
            return;
        }

        /*
         * ブラウザ / OS標準の重要操作と
         * 競合しないようにする。
         */

        const key =
            this.normalizeKey(event);

        if (key === null) {
            return;
        }

        /*
         * =================================================
         * Save
         * =================================================
         */

        if (key === 'save') {

            event.preventDefault();

            this.callbacks.onSave?.();

            return;
        }


        /*
         * =================================================
         * Escape
         * =================================================
         */

        if (key === 'escape') {

            /*
             * EscapeはpreventDefaultしない。
             *
             * モーダルやブラウザ側の挙動を
             * 不必要に妨害しない。
             */

            this.callbacks.onEscape?.();

            return;
        }


        /*
         * =================================================
         * 入力中の判定
         * =================================================
         */

        const inputActive =
            this.isTextInputActive(event);


        /*
         * =================================================
         * Preview Toggle
         * =================================================
         *
         * Ctrl/Cmd + Shift + P
         */

        if (
            key === 'toggle-preview'
        ) {

            event.preventDefault();

            this.callbacks
                .onTogglePreview?.();

            return;
        }


        /*
         * =================================================
         * Page Navigation
         * =================================================
         */

        if (
            key === 'next-page' ||
            key === 'prev-page'
        ) {

            /*
             * 通常の入力欄では
             * ページ移動しない。
             */

            if (
                inputActive &&
                !this.options
                    .allowPageNavigationInInputs
            ) {
                return;
            }

            /*
             * Editor側でArrowLeft / Rightを
             * カーソル操作として使えるようにする。
             *
             * PageUp / PageDownは必要なら
             * 後から許可できる。
             */

            if (
                inputActive &&
                !this.options
                    .allowPageNavigationInEditor
            ) {

                if (
                    event.key ===
                        'ArrowLeft' ||
                    event.key ===
                        'ArrowRight'
                ) {
                    return;
                }
            }

            event.preventDefault();

            if (
                key === 'next-page'
            ) {

                this.callbacks
                    .onNextPage?.();

            } else {

                this.callbacks
                    .onPrevPage?.();
            }

            return;
        }
    }


    /* =====================================================
       Key Normalization
    ====================================================== */

    private normalizeKey(
        event: KeyboardEvent
    ): NormalizedKey {

        const modifier =
            this.isPrimaryModifier(event);


        /*
         * Ctrl/Cmd + S
         */

        if (
            modifier &&
            event.key.toLowerCase() === 's'
        ) {
            return 'save';
        }


        /*
         * Ctrl/Cmd + Shift + P
         *
         * プレビュー切替。
         */

        if (
            modifier &&
            event.shiftKey &&
            event.key.toLowerCase() === 'p'
        ) {
            return 'toggle-preview';
        }


        /*
         * Escape
         */

        if (
            event.key === 'Escape'
        ) {
            return 'escape';
        }


        /*
         * Next Page
         */

        if (
            event.key === 'ArrowRight' ||
            event.key === 'PageDown'
        ) {
            return 'next-page';
        }


        /*
         * Previous Page
         */

        if (
            event.key === 'ArrowLeft' ||
            event.key === 'PageUp'
        ) {
            return 'prev-page';
        }


        /*
         * Space
         *
         * ReaderController側で
         * 「読書モードの場合だけ」処理する。
         *
         * KeyboardController自身は
         * モードを知らないため、
         * callbackだけ呼ぶ。
         */

        if (
            this.options
                .enableSpaceNavigation &&
            event.code === 'Space' &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            return 'next-page';
        }


        return null;
    }


    /* =====================================================
       Modifier
    ====================================================== */

    private isPrimaryModifier(
        event: KeyboardEvent
    ): boolean {

        /*
         * Mac：
         * Command

         * Windows / Linux：
         * Ctrl
         */

        return this.isMac()
            ? event.metaKey
            : event.ctrlKey;
    }


    private isMac(): boolean {

        /*
         * userAgentData.platformを優先。
         *
         * 非対応ブラウザ向けに
         * navigator.platformをfallback。
         */

        const platform =
            (
                navigator as Navigator & {
                    userAgentData?: {
                        platform?: string;
                    };
                }
            )
                .userAgentData
                ?.platform;

        if (platform) {
            return /mac/i.test(
                platform
            );
        }

        return /mac/i.test(
            navigator.platform ?? ''
        );
    }


    /* =====================================================
       Input Detection
    ====================================================== */

    private isTextInputActive(
        event: KeyboardEvent
    ): boolean {

        const target =
            event.target;

        if (
            !(target instanceof HTMLElement)
        ) {
            return false;
        }


        /*
         * textarea
         */

        if (
            target instanceof
            HTMLTextAreaElement
        ) {
            return true;
        }


        /*
         * input
         */

        if (
            target instanceof
            HTMLInputElement
        ) {

            /*
             * checkbox / radio / buttonなどは
             * テキスト入力ではない。
             */

            const type =
                (
                    target.type ||
                    'text'
                ).toLowerCase();

            return ![
                'button',
                'checkbox',
                'radio',
                'range',
                'submit',
                'reset',
                'file',
                'color',
                'hidden'
            ].includes(type);
        }


        /*
         * select
         */

        if (
            target instanceof
            HTMLSelectElement
        ) {
            return true;
        }


        /*
         * contenteditable
         */

        if (
            target.isContentEditable ||
            target.closest(
                '[contenteditable="true"]'
            ) !== null
        ) {
            return true;
        }


        return false;
    }
}
