```ts
import { AppState, NovelState } from './AppState';
import { UIController } from '../ui/UIController';
import { EditorController } from '../editor/EditorController';
import { ReaderController } from '../reader/ReaderController';
import { IndexedDBStore } from '../store/IndexedDBStore';
import { SaveScheduler } from '../store/SaveScheduler';
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
     * アプリケーションを初期化する。
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
             * 1. 保存データを先にロード。
             */
            const savedData =
                await this.loadSavedState();

            if (savedData) {
                this.state.replaceState(
                    savedData
                );
            }

            /*
             * 2. State変更を監視。
             *
             * 保存処理はSaveSchedulerへ委譲する。
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
             * 3. Controller初期化。
             */
            this.uiController.init();
            this.editorController.init();
            this.readerController.init();

            /*
             * 4. 初期化完了。
             */
            this.state.markInitialized();

            this.initialized = true;
        } catch (error) {
            console.error(
                'アプリケーションの初期化に失敗しました:',
                error
            );

            this.unsubscribeState?.();
            this.unsubscribeState =
                undefined;

            throw error;
        } finally {
            this.initializing = false;
        }
    }

    /**
     * 保存済みStateを読み込む。
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
     * State変更を自動保存へ渡す。
     *
     * SaveSchedulerがデバウンス、
     * 保存中の変更、失敗時の再保存を管理する。
     */
    private handleStateChange(
        state: Readonly<NovelState>
    ): void {
        if (
            !this.initialized
        ) {
            return;
        }

        /*
         * AppStateの保存状態そのものが変更された場合に
         * 保存予約を発生させない。
         *
         * 作品データの変更だけを保存対象とする。
         */
        if (
            state.saveStatus ===
                'saving' ||
            state.saveStatus ===
                'saved'
        ) {
            return;
        }

        this.saveScheduler.schedule(
            state,
            (status) => {
                this.handleSaveStatus(
                    status
                );
            }
        );
    }

    /**
     * SaveSchedulerの状態をAppStateへ反映する。
     *
     * ここでは保存状態だけを更新するため、
     * handleStateChange側で保存予約しない。
     */
    private handleSaveStatus(
        status:
            | 'dirty'
            | 'saving'
            | 'saved'
            | 'error'
    ): void {
        if (
            !this.initialized
        ) {
            return;
        }

        switch (status) {
            case 'dirty':
                if (
                    this.state
                        .getState()
                        .saveStatus !==
                    'dirty'
                ) {
                    this.state.markDirty();
                }
                break;

            case 'saving':
                if (
                    this.state
                        .getState()
                        .saveStatus !==
                    'saving'
                ) {
                    this.state.markSaving();
                }
                break;

            case 'saved':
                this.state.markSaved();
                break;

            case 'error':
                this.state.markSaveError();
                break;
        }
    }

    /**
     * 保存データを正規化する。
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
     * Controller / Schedulerをすべて破棄する。
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
         * 最終状態を保存。
         *
         * 初期化済みの場合のみ実行。
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
         * Controller破棄。
         */
        this.readerController.destroy();
        this.editorController.destroy();
        this.uiController.destroy();

        /*
         * Scheduler破棄。
         */
        this.saveScheduler.destroy();

        this.initialized = false;
        this.initializing = false;
    }
}
```
