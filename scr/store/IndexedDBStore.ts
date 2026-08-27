import { NovelState, Chapter } from '../app/AppState';

export class IndexedDBStore {
    private readonly dbName = 'NovelEditorPRO';
    private readonly storeName = 'novels';
    private readonly dbVersion = 2;
    private readonly currentNovelKey = 'current-novel';

    private dbPromise: Promise<IDBDatabase> | null = null;

    /* =========================================================
       DB
    ========================================================== */

    private openDB(): Promise<IDBDatabase> {
        if (this.dbPromise) {
            return this.dbPromise;
        }

        this.dbPromise = new Promise<IDBDatabase>(
            (resolve, reject) => {
                const request = indexedDB.open(
                    this.dbName,
                    this.dbVersion
                );

                request.onerror = () => {
                    this.dbPromise = null;

                    reject(
                        request.error ??
                        new Error(
                            'IndexedDBを開けませんでした。'
                        )
                    );
                };

                request.onblocked = () => {
                    console.warn(
                        'IndexedDBのアップグレードがブロックされています。'
                    );
                };

                request.onupgradeneeded = (
                    event
                ) => {
                    const db =
                        (
                            event.target as
                            IDBOpenDBRequest
                        ).result;

                    /*
                     * =================================================
                     * novels
                     * =================================================
                     */

                    if (
                        !db.objectStoreNames.contains(
                            this.storeName
                        )
                    ) {
                        db.createObjectStore(
                            this.storeName
                        );
                    }
                };

                request.onsuccess = () => {
                    const db =
                        request.result;

                    /*
                     * 他タブなどからDBが削除・変更された場合。
                     */

                    db.onversionchange = () => {
                        db.close();

                        this.dbPromise = null;
                    };

                    resolve(db);
                };
            }
        );

        return this.dbPromise;
    }


    /* =========================================================
       Save
    ========================================================== */

    public async save(
        state: NovelState
    ): Promise<void> {

        const normalizedState =
            this.normalizeState(state);

        const db =
            await this.openDB();

        await new Promise<void>(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        this.storeName,
                        'readwrite'
                    );

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                store.put(
                    normalizedState,
                    this.currentNovelKey
                );

                transaction.oncomplete = () => {
                    resolve();
                };

                transaction.onerror = () => {
                    reject(
                        transaction.error ??
                        new Error(
                            '作品の保存に失敗しました。'
                        )
                    );
                };

                transaction.onabort = () => {
                    reject(
                        transaction.error ??
                        new Error(
                            '作品の保存処理が中断されました。'
                        )
                    );
                };
            }
        );
    }


    /* =========================================================
       Load
    ========================================================== */

    public async load():
        Promise<NovelState | null> {

        const db =
            await this.openDB();

        return new Promise<
            NovelState | null
        >(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        this.storeName,
                        'readonly'
                    );

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                const request =
                    store.get(
                        this.currentNovelKey
                    );

                request.onsuccess = () => {

                    const result =
                        request.result;

                    if (!result) {
                        resolve(null);
                        return;
                    }

                    try {
                        const state =
                            this.normalizeState(
                                result
                            );

                        resolve(state);
                    } catch (error) {
                        reject(error);
                    }
                };

                request.onerror = () => {
                    reject(
                        request.error ??
                        new Error(
                            '作品の読み込みに失敗しました。'
                        )
                    );
                };

                transaction.onerror = () => {
                    reject(
                        transaction.error ??
                        new Error(
                            '読み込みトランザクションに失敗しました。'
                        )
                    );
                };
            }
        );
    }


    /* =========================================================
       Delete
    ========================================================== */

    public async deleteCurrentNovel():
        Promise<void> {

        const db =
            await this.openDB();

        await new Promise<void>(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        this.storeName,
                        'readwrite'
                    );

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                store.delete(
                    this.currentNovelKey
                );

                transaction.oncomplete = () => {
                    resolve();
                };

                transaction.onerror = () => {
                    reject(
                        transaction.error ??
                        new Error(
                            '作品の削除に失敗しました。'
                        )
                    );
                };

                transaction.onabort = () => {
                    reject(
                        transaction.error ??
                        new Error(
                            '作品の削除処理が中断されました。'
                        )
                    );
                };
            }
        );
    }


    /* =========================================================
       Exists
    ========================================================== */

    public async exists(): Promise<boolean> {

        const db =
            await this.openDB();

        return new Promise<boolean>(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        this.storeName,
                        'readonly'
                    );

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                const request =
                    store.getKey(
                        this.currentNovelKey
                    );

                request.onsuccess = () => {
                    resolve(
                        request.result !== undefined
                    );
                };

                request.onerror = () => {
                    reject(
                        request.error ??
                        new Error(
                            '作品の存在確認に失敗しました。'
                        )
                    );
                };
            }
        );
    }


    /* =========================================================
       Normalize
    ========================================================== */

    private normalizeState(
        raw: unknown
    ): NovelState {

        if (
            !raw ||
            typeof raw !== 'object'
        ) {
            throw new Error(
                '保存データが不正です。'
            );
        }

        const data =
            raw as Partial<NovelState>;

        if (
            typeof data.title !== 'string'
        ) {
            throw new Error(
                '作品タイトルが不正です。'
            );
        }

        if (
            !Array.isArray(data.chapters) ||
            data.chapters.length === 0
        ) {
            throw new Error(
                '章データが存在しません。'
            );
        }

        const chapters: Chapter[] =
            data.chapters.map(
                (chapter, index) => {

                    if (
                        !chapter ||
                        typeof chapter !==
                            'object'
                    ) {
                        throw new Error(
                            `第${index + 1}章のデータが不正です。`
                        );
                    }

                    if (
                        typeof chapter.id !==
                            'string' ||
                        chapter.id.length === 0
                    ) {
                        throw new Error(
                            `第${index + 1}章のIDが不正です。`
                        );
                    }

                    const title =
                        typeof chapter.title ===
                            'string'
                            ? chapter.title
                            : `第${index + 1}章`;

                    const content =
                        typeof chapter.content ===
                            'string'
                            ? chapter.content
                            : '';

                    /*
                     * 保存されているcharacterCountを
                     * 信用しない。
                     *
                     * 本文から必ず再計算する。
                     */

                    return {
                        id: chapter.id,
                        title,
                        content,
                        characterCount:
                            Array.from(content).length
                    };
                }
            );

        const currentChapterId =
            typeof data.currentChapterId ===
                'string' &&
            chapters.some(
                chapter =>
                    chapter.id ===
                    data.currentChapterId
            )
                ? data.currentChapterId
                : chapters[0].id;

        const currentPageIndex =
            Number.isInteger(
                data.currentPageIndex
            ) &&
            (data.currentPageIndex as number) >=
                0
                ? data.currentPageIndex as number
                : 0;

        const currentMode =
            data.currentMode === 'preview' ||
            data.currentMode === 'reading'
                ? data.currentMode
                : 'editor';

        const totalCharacterCount =
            chapters.reduce(
                (
                    total,
                    chapter
                ) =>
                    total +
                    chapter.characterCount,
                0
            );

        return {
            title:
                data.title.trim() ||
                '無題の作品',

            chapters,

            currentChapterId,

            currentMode,

            currentPageIndex,

            totalCharacterCount,

            /*
             * 起動直後は保存済みデータを
             * 「保存済み」として扱う。
             */

            saveStatus: 'saved',

            lastSavedAt:
                typeof data.lastSavedAt ===
                    'number'
                    ? data.lastSavedAt
                    : null,

            initialized: false
        };
    }


    /* =========================================================
       Close
    ========================================================== */

    public close(): void {

        if (!this.dbPromise) {
            return;
        }

        void this.dbPromise
            .then(db => {
                db.close();
            })
            .catch(() => {
                /*
                 * 既に失敗している場合は何もしない。
                 */
            })
            .finally(() => {
                this.dbPromise = null;
            });
    }
}
