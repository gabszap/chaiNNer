import { installWebShims } from './bootstrap';

installWebShims();

// Import renderer only after window.appConstants and window.unsafeIpcRenderer are installed.
import('../renderer/renderer').catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize chaiNNer WebUI renderer:', error);
});
