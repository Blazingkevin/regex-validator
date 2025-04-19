import { io, Socket } from 'socket.io-client';
import { ConnectionState } from '../types/job';

type EventCallback = (...args: any[]) => void;

class SocketManager {
     socket: Socket | null = null;
    private listeners: Map<string, Set<EventCallback>> = new Map();
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private readonly baseReconnectDelay = 1000; 
    private connectionState: ConnectionState = 'disconnected';
    private connectionStateListeners: Set<(state: ConnectionState) => void> = new Set();

    connect(url: string): void {
        if (this.socket) {
            return;
        }

        this.updateConnectionState('connecting');

        this.socket = io(url, {
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.baseReconnectDelay,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        // Set up connection event handlers
        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.reconnectAttempts = 0;
            this.updateConnectionState('connected');
        });

        this.socket.on('disconnect', (reason) => {
            console.log(`Socket disconnected: ${reason}`);
            this.updateConnectionState('disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.reconnectAttempts++;
            this.updateConnectionState('connecting');

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnection attempts reached, giving up');
                this.socket!.disconnect();
                this.updateConnectionState('disconnected');
            }
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`Attempting to reconnect (${attemptNumber}/${this.maxReconnectAttempts})`);
            this.updateConnectionState('connecting');
        });

        this.socket.on('reconnect', () => {
            console.log('Socket reconnected');
            this.updateConnectionState('connected');
            this.requestSyncJobs();
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.updateConnectionState('disconnected');
        }
    }

    // on(event: string, callback: EventCallback): () => void {
    //     if (!this.listeners.has(event)) {
    //         this.listeners.set(event, new Set());

    //         if (this.socket) {
    //             this.socket.on(event, (...args) => {
    //                 const callbacks = this.listeners.get(event);
    //                 if (callbacks) {
    //                     callbacks.forEach(cb => cb(...args));
    //                 }
    //             });
    //         }
    //     }

    //     this.listeners.get(event)!.add(callback);
    //     console.log("Event listener added for:", event);

    //     return () => {
    //         const callbacks = this.listeners.get(event);
    //         console.log(callbacks?.size)
    //         if (callbacks) {
    //             callbacks.delete(callback);
    //         }
    //     };
    // }

    on(event: string, callback: EventCallback): () => void {
        // Initialize the listeners set if it doesn't exist
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        // Always ensure the socket.io listener is registered when the socket exists
        if (this.socket) {
            // Remove any existing listener to avoid duplicates
            this.socket.off(event);
            
            // Add the listener that will call all callbacks
            this.socket.on(event, (...args) => {
                console.log(`Event ${event} received with args:`, args);
                const callbacks = this.listeners.get(event);
                if (callbacks) {
                    callbacks.forEach(cb => {
                        try {
                            cb(...args);
                        } catch (error) {
                            console.error(`Error in callback for event ${event}:`, error);
                        }
                    });
                }
            });
        }
    
        // Add the callback to our internal set
        this.listeners.get(event)!.add(callback);
        console.log(`Event listener added for: ${event}, total listeners: ${this.listeners.get(event)!.size}`);
    
        // Return function to remove the listener
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.delete(callback);
                console.log(`Listener removed for ${event}, remaining: ${callbacks.size}`);
            }
        };
    }

    off(event: string, callback: EventCallback): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(event: string, ...args: any[]): boolean {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, ...args);
            return true;
        }
        return false;
    }

    requestSyncJobs(): void {
        this.emit('SYNC_JOBS');
    }

    onConnectionStateChange(callback: (state: ConnectionState) => void): () => void {
        this.connectionStateListeners.add(callback);
        callback(this.connectionState);

        return () => {
            this.connectionStateListeners.delete(callback);
        };
    }

    updateConnectionState(state: ConnectionState): void {
        this.connectionState = state;
        this.connectionStateListeners.forEach(listener => {
            try {
                listener(state);
            } catch (error) {
                console.error('Error in connection state listener:', error);
            }
        });
    }
}


const socketManager = new SocketManager();
export default socketManager;