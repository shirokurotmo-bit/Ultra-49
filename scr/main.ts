import { App } from './app/App';

function showFatalError(error: unknown): void {
    console.error(
        '縦読み小説エディタ PRO の初期化に失敗しました:',
        error
    );

    const message =
        error instanceof Error
            ? error.message
            : '予期しないエラーが発生しました。';

    const existing = document.getElementById('fatal-error');

    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement('div');

    overlay.id = 'fatal-error';

    overlay.setAttribute('role', 'alert');

    overlay.innerHTML = `
        <div class="fatal-error-panel">
            <div class="fatal-error-icon">!</div>
            <h1>アプリケーションを起動できませんでした</h1>
            <p>
                初期化中に問題が発生しました。
                ページを再読み込みしてください。
            </p>
            <details>
                <summary>エラー詳細</summary>
                <pre>${escapeHtml(message)}</pre>
            </details>
            <button type="button" id="fatal-error-reload">
                再読み込み
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    document
        .getElementById('fatal-error-reload')
        ?.addEventListener('click', () => {
            window.location.reload();
        });
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function bootstrap(): Promise<void> {
    try {
        const app = new App();

        await app.init();
    } catch (error) {
        showFatalError(error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        () => {
            void bootstrap();
        },
        { once: true }
    );
} else {
    void bootstrap();
}
