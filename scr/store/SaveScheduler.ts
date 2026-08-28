```ts
import { AppState, NovelState } from './AppState';
import { UIController } from '../ui/UIController';
import { EditorController } from '../editor/EditorController';
import { ReaderController } from '../reader/ReaderController';
import { IndexedDBStore } from '../store/IndexedDBStore';
import { SaveScheduler, SaveStatus } from '../store/SaveScheduler';
import { PaginationEngine } from '../pagination/PaginationEngine';

export class App {
    private readonly state: AppState;
    private readonly store: IndexedDBStore;
    private readonly saveScheduler: SaveScheduler;
    private readonly paginationEngine: PaginationEngine;

    private readonly uiController: UIController;
    private readonly editorController: EditorController;
    private readonly readerController: ReaderController;

    private unsubscribeState?: () => void;

    private initialized = false;
    private initializing = false;

    constructor() {
        this.state = new AppState();

        this.store = new IndexedDBStore();

        this.saveScheduler =
            new SaveScheduler(
                this.store,
                1000
            );

        this.paginationEngine =
            new PaginationEngine();

        this.uiController =
            new UIController(
                this.state
            );

        this.editorController =
            new EditorController(
                this.state
            );

        this.readerController =
            new ReaderController(
                this.state,
                this.paginationEngine
            );
    }

    /**
     * アプリケーションを初期化。
     */
    public async init(): Promise<void> {
        if (
            this.initialized ||
            this.initializing
        ) {
            return;
        }

        this.initializing = true;

        try {
            /*
             * 1. 保存データをロード。
             */
            const savedData =
                await this.loadSavedState();

            if (savedData) {
                this.state.replaceState(
                    savedData
                );
            }

            /*
             * 2. SaveSchedulerの状態通知を登録。
             *
             * Schedulerからの保存状態だけを
             * AppStateへ反映する。
             */
            this.saveScheduler.setStatusListener(
                this.handleSaveStatus
            );

            /*
             * 3. State変更を監視。
             *
             * 保存処理そのものはSaveSchedulerへ
             * 委譲する。
             */
            this.unsubscribeState =
                this.state.subscribe(
                    (newState) => {
                        this.handleStateChange(
                            newState
                        );
                    }
                );

            /*
             * 4. Controller初期化。
             */
            this.uiController.init();
            this.editorController.init();
            this.readerController.init();

            /*
             * 5. 初期化完了。
             */
            this.initialized = true;

            this.state.markInitialized();
        } catch (error) {
            this.unsubscribeState?.();
            this.unsubscribeState =
                undefined;

            this.saveScheduler.destroy();

            this.initializing = false;

            console.error(
                'アプリケーションの初期化に失敗しました:',
                error
            );

            throw error;
        }

        this.initializing = false;
    }

    /**
     * State変更時の保存予約。
     */
    private handleStateChange(
        state: Readonly<NovelState>
    ): void {
        if (!this.initialized) {
            return;
        }

        /*
         * UI表示だけの変更では保存不要。
         *
         * 保存対象となる変更はAppState側で
         * saveStatus='dirty'になる。
         */
        if (
            state.saveStatus !== 'dirty' &&
            state.saveStatus !== 'error'
        ) {
            return;
        }

        this.saveScheduler.schedule(
            state
        );
    }

    /**
     * SaveSchedulerからの状態通知。
     */
    private handleSaveStatus = (
        status: SaveStatus
    ): void => {
        if (!this.initialized) {
            return;
        }

        switch (status) {
            case 'dirty':
                /*
                 * 既にdirtyならmarkDirty()は
                 * State変更を発生させない。
                 */
                this.state.markDirty();
                break;

            case 'saving':
                this.state.markSaving();
                break;

            case 'saved':
                this.state.markSaved();
                break;

            case 'error':
                this.state.markSaveError();
                break;
        }
    };

    /**
     * 保存済みStateをロード。
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
            console.error(
                '保存データの読み込みに失敗しました:',
                error
            );

            return null;
        }
    }

    /**
     * 読み込んだStateを正規化。
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
            !Array.isArray(
                data.chapters
            ) ||
            data.chapters.length === 0
        ) {
            throw new Error(
                '保存データに有効な章がありません。'
            );
        }

        const currentChapterExists =
            data.chapters.some(
                (chapter) =>
                    chapter.id ===
                    data.currentChapterId
            );

        if (
            !currentChapterExists
        ) {
            return {
                ...data,
                currentChapterId:
                    data.chapters[0].id,
                currentPageIndex: 0,
            };
        }

        return data;
    }

    /**
     * アプリケーションを破棄。
     */
    public async destroy(): Promise<void> {
        if (
            !this.initialized &&
            !this.initializing
        ) {
            return;
        }

        /*
         * State通知を停止。
         */
        this.unsubscribeState?.();

        this.unsubscribeState =
            undefined;

        /*
         * 終了前に最新Stateを保存。
         */
        if (this.initialized) {
            try {
                await this.saveScheduler.flush(
                    this.state.getState()
                );
            } catch (error) {
                console.error(
                    '終了時の保存に失敗しました:',
                    error
                );
            }
        }

        /*
         * Controllerを破棄。
         */
        this.readerController.destroy();
        this.editorController.destroy();
        this.uiController.destroy();

        /*
         * Schedulerを破棄。
         */
        this.saveScheduler.destroy();

        /*
         * PaginationEngineはReaderControllerが
         * 管理しているため、ここではdestroyしない。
         */
        this.initialized = false;
        this.initializing = false;
    }
}
```
