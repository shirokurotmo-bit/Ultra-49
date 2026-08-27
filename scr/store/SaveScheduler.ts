import { NovelState } from '../app/AppState';
import { IndexedDBStore } from './IndexedDBStore';

export type SaveStatus =
    | 'dirty'
    | 'saving'
    | 'saved'
    | 'error';

export type SaveStatusListener =
    (status: SaveStatus) => void;

export class SaveScheduler {
    private timerId: number | null = null;

    private readonly delayMs: number;

    private pendingState: NovelState | null = null;

    private savePromise: Promise<void> | null = null;

    private saveRequestedWhileSaving = false;

    private destroyed = false;

    private statusListener:
        SaveStatusListener | null = null;

    constructor(
        private readonly store: IndexedDBStore,
        delayMs = 1000
    ) {
        this.delayMs = Math.max(
            250,
            delayMs
        );
    }

    /* =========================================================
       Public API
    ========================================================== */

    public schedule(
        state: NovelState,
        onStatusChange?: SaveStatusListener
    ): void {

        if (this.destroyed) {
            return;
        }

        if (onStatusChange) {
            this.statusListener =
                onStatusChange;
        }

        /*
         * 保存予約時点のスナップショットを保持。
         *
         * AppStateがその後変更されても、
         * 「何を保存する予定だったか」が
         * 曖昧にならない。
         */

        this.pendingState =
            this.cloneState(state);

        this.emitStatus('dirty');

        /*
         * 現在保存中ならタイマーだけ設定せず、
         * 「保存後にもう一度保存する」ことを記録する。
         */

        if (this.savePromise !== null) {
            this.saveRequestedWhileSaving =
                true;

            return;
        }

        this.clearTimer();

        this.timerId =
            window.setTimeout(() => {
                this.timerId = null;

                void this.executePendingSave();
            }, this.delayMs);
    }


    public async flush(
        state: NovelState
    ): Promise<void> {

        if (this.destroyed) {
            return;
        }

        this.clearTimer();

        /*
         * flush時点の最新Stateを優先。
         */

        this.pendingState =
            this.cloneState(state);

        /*
         * すでに保存中なら、その処理が終わった後に
         * 最新Stateを保存する。
         */

        if (this.savePromise !== null) {
            this.saveRequestedWhileSaving =
                true;

            await this.savePromise;

            /*
             * 保存完了後に別のstateが
             * 入っていれば、それを保存。
             */

            if (
                this.pendingState !== null
            ) {
                await this.executePendingSave();
            }

            return;
        }

        await this.executePendingSave();
    }


    public cancel(): void {

        this.clearTimer();

        this.pendingState = null;

        this.saveRequestedWhileSaving =
            false;
    }


    public destroy(): void {

        this.destroyed = true;

        this.clearTimer();

        this.pendingState = null;

        this.saveRequestedWhileSaving =
            false;

        this.statusListener = null;
    }


    public setStatusListener(
        listener:
            SaveStatusListener | null
    ): void {

        this.statusListener = listener;
    }


    /* =========================================================
       Save
    ========================================================== */

    private async executePendingSave():
        Promise<void> {

        if (this.destroyed) {
            return;
        }

        if (this.savePromise !== null) {
            this.saveRequestedWhileSaving =
                true;

            return this.savePromise;
        }

        const stateToSave =
            this.pendingState;

        if (stateToSave === null) {
            return;
        }

        /*
         * 保存対象を一旦取り出す。
         *
         * 新しい入力が来た場合は、
         * pendingStateに新しいStateが入る。
         */

        this.pendingState = null;

        this.emitStatus('saving');

        const operation =
            this.performSave(
                stateToSave
            );

        this.savePromise =
            operation;

        try {
            await operation;
        } finally {
            this.savePromise = null;
        }

        /*
         * 保存中に新しい入力が発生した場合。
         */

        if (
            this.saveRequestedWhileSaving ||
            this.pendingState !== null
        ) {

            this.saveRequestedWhileSaving =
                false;

            /*
             * 直ちに最新Stateを保存。
             *
             * ここではdelayを再度待たせない。
             */

            if (
                this.pendingState !== null
            ) {
                await this.executePendingSave();
            }
        }
    }


    private async performSave(
        state: NovelState
    ): Promise<void> {

        try {

            await this.store.save(
                state
            );

            if (!this.destroyed) {
                this.emitStatus('saved');
            }

        } catch (error) {

            console.error(
                '自動保存に失敗しました:',
                error
            );

            /*
             * 保存に失敗したStateを
             * 失わないようにする。
             */

            if (!this.destroyed) {
                this.pendingState =
                    state;

                this.emitStatus(
                    'error'
                );
            }

            throw error;
        }
    }


    /* =========================================================
       Snapshot
    ========================================================== */

    private cloneState(
        state: NovelState
    ): NovelState {

        /*
         * NovelStateはJSON互換のデータ構造なので、
         * structuredCloneを優先する。
         *
         * 古いブラウザ向けにfallbackも用意。
         */

        if (
            typeof structuredClone ===
            'function'
        ) {
            return structuredClone(
                state
            );
        }

        return JSON.parse(
            JSON.stringify(state)
        ) as NovelState;
    }


    /* =========================================================
       Timer
    ========================================================== */

    private clearTimer(): void {

        if (
            this.timerId !== null
        ) {
            window.clearTimeout(
                this.timerId
            );

            this.timerId = null;
        }
    }


    /* =========================================================
       Status
    ========================================================== */

    private emitStatus(
        status: SaveStatus
    ): void {

        try {
            this.statusListener?.(
                status
            );
        } catch (error) {

            /*
             * UI側のstatus callbackが
             * 保存処理そのものを壊さない。
             */

            console.error(
                '保存状態コールバックでエラーが発生しました:',
                error
            );
        }
    }
}
