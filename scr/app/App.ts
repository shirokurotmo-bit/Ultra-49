import { AppState, NovelState } from './AppState';
import { UIController } from '../ui/UIController';
import { EditorController } from '../editor/EditorController';
import { ReaderController } from '../reader/ReaderController';
import { IndexedDBStore } from '../store/IndexedDBStore';
import { PaginationEngine } from '../pagination/PaginationEngine';

export class App {
    private readonly state: AppState;
    private readonly store: IndexedDBStore;
    private readonly paginationEngine: PaginationEngine;

    private readonly uiController: UIController;
    private readonly editorController: EditorController;
    private readonly readerController: ReaderController;

    private unsubscribeState?: () => void;

    private initialized = false;

    constructor() {
        /*
         * =====================================================
         * Core
         * =====================================================
         */

        this.state = new AppState();

        this.store = new IndexedDBStore();

        this.paginationEngine =
            new PaginationEngine();

        /*
         * =====================================================
         * Controllers
         * =====================================================
         *
         * Controller同士を直接依存させず、
         * AppStateを中心に接続する。
         */

        this.uiController =
            new UIController(this.state);

        this.editorController =
            new EditorController(this.state);

        this.readerController =
            new ReaderController(
                this.state,
                this.paginationEngine
            );
    }

    public async init(): Promise<void> {
        /*
         * 二重初期化防止
         */

        if (this.initialized) {
            return;
        }

        /*
         * =====================================================
         * 1. 保存データをロード
         * =====================================================
         *
         * UIを初期化する前にロードする。
         *
         * 先にUIを描画してから保存データを入れると、
         * 初期状態 → 保存状態という不要な再描画が発生する。
         */

        const savedData =
            await this.loadSavedState();

        if (savedData) {
            this.state.replaceState(
                savedData
            );
        }

        /*
         * =====================================================
         * 2. State変更監視
         * =====================================================
         *
         * ただし、この段階では保存処理そのものを
         * 直接subscribeにぶら下げる。
         *
         * 将来的にはここをSaveSchedulerへ置き換える。
         *
         * 現状のIndexedDBStore APIを維持しながら、
         * App側の責務を整理する。
         */

        this.unsubscribeState =
            this.state.subscribe(
                (newState) => {
                    void this.handleStateChange(
                        newState
                    );
                }
            );

        /*
         * =====================================================
         * 3. Controller初期化
         * =====================================================
         */

        this.uiController.init();

        this.editorController.init();

        this.readerController.init();

        /*
         * =====================================================
         * 4. 初期化完了
         * =====================================================
         */

        this.state.markInitialized();

        this.initialized = true;
    }

    /*
     * =========================================================
     * Saved State
     * =========================================================
     */

    private async loadSavedState():
        Promise<NovelState | null> {

        try {
            const savedData =
                await this.store.load();

            if (!savedData) {
                return null;
            }

            return this.normalizeLoadedState(
                savedData
            );
        } catch (error) {
            /*
             * 保存データが壊れていても、
             * アプリそのものを起動不能にしない。
             */

            console.error(
                '保存データの読み込みに失敗しました:',
                error
            );

            return null;
        }
    }

    /*
     * =========================================================
     * State Change
     * =========================================================
     */

    private async handleStateChange(
        state: Readonly<NovelState>
    ): Promise<void> {

        /*
         * 初期化前の状態変更は保存しない。
         *
         * 初期データロード前に発生した状態を
         * IndexedDBへ書き戻す事故を防止する。
         */

        if (!this.initialized) {
            return;
        }

        /*
         * 保存中のエラーがUIを壊さないよう、
         * App側で例外を吸収する。
         */

        try {
            this.state.markSaving();

            await this.store.save(state);

            this.state.markSaved();
        } catch (error) {
            console.error(
                '作品の保存に失敗しました:',
                error
            );

            this.state.markSaveError();
        }
    }

    /*
     * =========================================================
     * Loaded State Normalization
     * =========================================================
     *
     * 古いバージョンのデータや、
     * 不完全なIndexedDBデータをそのままStateへ入れない。
     *
     * 実際のデータマイグレーションは
     * IndexedDBStore側で実装する。
     */

    private normalizeLoadedState(
        data: NovelState
    ): NovelState {

        if (!data) {
            throw new Error(
                '保存データが存在しません。'
            );
        }

        if (
            !Array.isArray(data.chapters) ||
            data.chapters.length === 0
        ) {
            throw new Error(
                '保存データに有効な章がありません。'
            );
        }

        const currentChapterExists =
            data.chapters.some(
                chapter =>
                    chapter.id ===
                    data.currentChapterId
            );

        if (!currentChapterExists) {
            return {
                ...data,

                currentChapterId:
                    data.chapters[0].id,

                currentPageIndex: 0
            };
        }

        return data;
    }

    /*
     * =========================================================
     * Destroy
     * =========================================================
     *
     * SPA化、テスト、将来的な作品切替などに備える。
     */

    public destroy(): void {

        this.unsubscribeState?.();

        this.unsubscribeState =
            undefined;

        this.initialized = false;
    }
}
