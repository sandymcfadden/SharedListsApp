import { ILogService } from '@/services/interfaces/ILogService';
import { IRealtimeService } from '@/services/interfaces/IRealtimeService';

interface ConnectionState {
  browserOnline: boolean;
  realtimeConnected: boolean;
  isOnline: boolean;
  lastUpdate: Date;
}

interface ConnectionChangeListener {
  (state: ConnectionState): void;
}

export class ConnectionMonitor {
  private static instance: ConnectionMonitor;
  private logger: ILogService;
  private realtimeService: IRealtimeService;

  private connectionState: ConnectionState = {
    browserOnline: navigator.onLine,
    realtimeConnected: false,
    isOnline: false,
    lastUpdate: new Date(),
  };

  private listeners: ConnectionChangeListener[] = [];
  private isStarted = false;

  // Store event handler references for proper cleanup
  private browserOnlineHandler: () => void;
  private browserOfflineHandler: () => void;
  private realtimeConnectionHandler: (connected: boolean) => void;

  private constructor(logger: ILogService, realtimeService: IRealtimeService) {
    this.logger = logger;
    this.realtimeService = realtimeService;

    // Create bound event handlers for proper cleanup
    this.browserOnlineHandler = () => this.handleBrowserOnline();
    this.browserOfflineHandler = () => this.handleBrowserOffline();
    this.realtimeConnectionHandler = (connected: boolean) =>
      this.handleRealtimeConnectionChange(connected);
  }

  static getInstance(
    logger: ILogService,
    realtimeService: IRealtimeService
  ): ConnectionMonitor {
    if (!ConnectionMonitor.instance) {
      ConnectionMonitor.instance = new ConnectionMonitor(
        logger,
        realtimeService
      );
    }
    return ConnectionMonitor.instance;
  }

  /**
   * Start monitoring connection state
   */
  start(): void {
    if (this.isStarted) {
      this.logger.infoSync('Connection monitor is already started');
      return;
    }

    this.logger.infoSync('Starting connection monitor...');

    // Set up browser online/offline listeners
    window.addEventListener('online', this.browserOnlineHandler);
    window.addEventListener('offline', this.browserOfflineHandler);

    // Set up realtime service connection listener
    this.realtimeService.onConnectionChange(this.realtimeConnectionHandler);

    // Initialize connection state
    const initialRealtimeConnected = this.realtimeService.isConnected();
    this.logger.infoSync('Initial connection state:', {
      browserOnline: navigator.onLine,
      realtimeConnected: initialRealtimeConnected,
    });

    this.updateConnectionState({
      browserOnline: navigator.onLine,
      realtimeConnected: initialRealtimeConnected,
    });

    this.isStarted = true;
    this.logger.infoSync('Connection monitor started successfully');
  }

  /**
   * Stop monitoring connection state
   */
  stop(): void {
    if (!this.isStarted) {
      this.logger.infoSync('Connection monitor is not started');
      return;
    }

    this.logger.infoSync('Stopping connection monitor...');

    // Remove browser listeners
    window.removeEventListener('online', this.browserOnlineHandler);
    window.removeEventListener('offline', this.browserOfflineHandler);

    // Remove realtime service listener
    this.realtimeService.removeConnectionListener(
      this.realtimeConnectionHandler
    );

    this.isStarted = false;
    this.logger.infoSync('Connection monitor stopped');
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Check if we're online (both browser and realtime)
   */
  isOnline(): boolean {
    return this.connectionState.isOnline;
  }

  /**
   * Add a connection change listener
   */
  onConnectionChange(listener: ConnectionChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a connection change listener
   */
  removeConnectionListener(listener: ConnectionChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Handle browser online event
   */
  private handleBrowserOnline(): void {
    this.logger.infoSync('Browser went online');
    this.updateConnectionState({
      browserOnline: true,
      realtimeConnected: this.connectionState.realtimeConnected,
    });
  }

  /**
   * Handle browser offline event
   */
  private handleBrowserOffline(): void {
    this.logger.infoSync('Browser went offline');
    this.updateConnectionState({
      browserOnline: false,
      realtimeConnected: this.connectionState.realtimeConnected,
    });
  }

  /**
   * Handle realtime service connection change
   */
  private handleRealtimeConnectionChange(connected: boolean): void {
    this.logger.infoSync(
      `Realtime service ${connected ? 'connected' : 'disconnected'}`
    );
    this.updateConnectionState({
      browserOnline: this.connectionState.browserOnline,
      realtimeConnected: connected,
    });
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(updates: Partial<ConnectionState>): void {
    const oldState = { ...this.connectionState };

    this.connectionState = {
      ...this.connectionState,
      ...updates,
      lastUpdate: new Date(),
    };

    // Determine overall online status
    const wasOnline = this.connectionState.isOnline;
    this.connectionState.isOnline =
      this.connectionState.browserOnline &&
      this.connectionState.realtimeConnected;

    this.logger.infoSync('Connection state update:', {
      browserOnline: this.connectionState.browserOnline,
      realtimeConnected: this.connectionState.realtimeConnected,
      isOnline: this.connectionState.isOnline,
      wasOnline,
    });

    // Log state changes
    if (oldState.isOnline !== this.connectionState.isOnline) {
      this.logger.infoSync(
        `Connection state changed: ${oldState.isOnline ? 'online' : 'offline'} -> ${this.connectionState.isOnline ? 'online' : 'offline'}`
      );
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.connectionState);
      } catch (error) {
        this.logger.errorSync('Error in connection change listener:', error);
      }
    });
  }
}
