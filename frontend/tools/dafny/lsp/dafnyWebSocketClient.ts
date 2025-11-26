import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageclient/browser.js';

export class WebSocketToMessagePortAdapter {
    private websocket: WebSocket;
    private messagePort1: MessagePort;
    private messagePort2: MessagePort;

    constructor(url: string) {
        // Create a MessageChannel to bridge WebSocket and MessagePort
        const channel = new MessageChannel();
        this.messagePort1 = channel.port1;
        this.messagePort2 = channel.port2;

        this.websocket = new WebSocket(url);
        this.setupBridge();
    }

    private setupBridge() {
        // Forward messages from WebSocket to MessagePort
        this.websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.messagePort1.postMessage(message);
            } catch (error) {
                console.error('Failed to parse Dafny LSP WebSocket message:', error);
            }
        };

        // Forward messages from MessagePort to WebSocket
        this.messagePort2.onmessage = (event) => {
            if (this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify(event.data));
            }
        };

        this.websocket.onopen = () => {
            this.messagePort2.start();
        };

        this.websocket.onerror = (error) => {
            console.error('Dafny LSP WebSocket error:', error);
        };

        this.websocket.onclose = () => {
            this.messagePort1.close();
            this.messagePort2.close();
        };
    }

    getMessagePort(): MessagePort {
        return this.messagePort1;
    }

    close() {
        this.websocket.close();
        this.messagePort1.close();
        this.messagePort2.close();
    }
}

// Build WebSocket URL dynamically based on current host
function getDefaultLspUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/lsp-dafny/lsp`;
}

// Create a fake worker that encapsulates the WebSocket connection
export class DafnyWebSocketWorker {
    private websocket: WebSocket;
    private isConnected = false;
    private connectionFailed = false;
    private pendingMessages: any[] = [];
    private connectedPort: MessagePort | null = null;
    private connectionTimeout: NodeJS.Timeout | null = null;

    constructor(url: string = getDefaultLspUrl()) {
        this.websocket = new WebSocket(url);
        this.setupWebSocket();
        
        // Set connection timeout (5 seconds)
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                console.warn('Dafny LSP WebSocket connection timeout');
                this.connectionFailed = true;
                this.websocket.close();
            }
        }, 5000);
    }

    private setupWebSocket() {
        this.websocket.onopen = () => {
            this.isConnected = true;
            this.connectionFailed = false;
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }

            // Send any pending messages
            if (this.connectedPort && this.pendingMessages.length > 0) {
                this.pendingMessages.forEach(msg => {
                    this.websocket.send(JSON.stringify(msg));
                });
                this.pendingMessages = [];
            }
        };

        this.websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (this.connectedPort) {
                    this.connectedPort.postMessage(message);
                }
            } catch (error) {
                console.error('Error parsing Dafny LSP message:', error);
            }
        };

        this.websocket.onerror = (error) => {
            console.error('Dafny LSP WebSocket error:', error);
            this.connectionFailed = true;
        };

        this.websocket.onclose = () => {
            this.isConnected = false;
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
        };
    }

    isConnectionFailed(): boolean {
        return this.connectionFailed;
    }

    postMessage(data: any, transfer?: Transferable[]) {
        // Simulate worker behavior - when a port is passed, start the connection
        if (data.port && transfer && transfer[0] === data.port) {
            this.connectedPort = data.port;

            // Listen for messages from the language client
            data.port.onmessage = (event: MessageEvent) => {

                if (this.isConnected) {
                    this.websocket.send(JSON.stringify(event.data));
                } else {
                    // Queue messages until connected
                    this.pendingMessages.push(event.data);
                }
            };

            data.port.start();
        }
    }

    terminate() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        if (this.websocket) {
            this.websocket.close();
        }
        if (this.connectedPort) {
            this.connectedPort.close();
        }
    }
}

export function createDafnyMessageTransports(url: string = getDefaultLspUrl()) {
    const adapter = new WebSocketToMessagePortAdapter(url);
    const messagePort = adapter.getMessagePort();

    const reader = new BrowserMessageReader(messagePort);
    const writer = new BrowserMessageWriter(messagePort);

    return { reader, writer, adapter };
}

export function createDafnyWebSocketWorker(url: string = getDefaultLspUrl()) {
    return new DafnyWebSocketWorker(url);
}
