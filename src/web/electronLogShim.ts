/* eslint-disable import/no-default-export, no-console */

const webElectronLog = {
    transports: {
        ipc: { level: 'info' as string | false },
        console: { level: 'debug' as string | false },
    },
    error: (...args: unknown[]): void => {
        console.error('[chaiNNer]', ...args);
    },
    warn: (...args: unknown[]): void => {
        console.warn('[chaiNNer]', ...args);
    },
    info: (...args: unknown[]): void => {
        console.info('[chaiNNer]', ...args);
    },
    debug: (...args: unknown[]): void => {
        console.debug('[chaiNNer]', ...args);
    },
};

export default webElectronLog;
