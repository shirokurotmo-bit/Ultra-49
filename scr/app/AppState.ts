```ts
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
     * dirtyになったStateだけを
     * SaveSchedulerへ渡す。
     *
     * saving / saved / error は
     * 保存処理の結果であり、
     * 新しい保存要求ではない。
     */
    if (state.saveStatus !== 'dirty') {
        return;
    }

    this.saveScheduler.schedule(state);
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
             * schedule()によって既に保存予約済み。
             * ここでmarkDirty()すると
             * State通知 → schedule() → dirty通知
             * のループになるため何もしない。
             */
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
```
