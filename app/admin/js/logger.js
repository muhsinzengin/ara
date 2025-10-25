// Logger - Production-ready logging system
class Logger {
  constructor(level = 'info') {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    this.currentLevel = this.levels[level] || this.levels.info;
    this.logs = [];
    this.maxLogs = 1000;
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  log(level, message, ...args) {
    if (this.levels[level] < this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      args: args.length > 0 ? args : undefined
    };

    // Store in memory for debugging
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output only in development
    if (process.env.NODE_ENV !== 'production') {
      const consoleMethod = level === 'debug' ? 'log' :
                           level === 'info' ? 'info' :
                           level === 'warn' ? 'warn' : 'error';

      console[consoleMethod](`[${timestamp}] ${level.toUpperCase()}: ${message}`, ...args);
    }

    // Send critical errors to backend
    if (level === 'error') {
      this.reportError(logEntry);
    }
  }

  async reportError(logEntry) {
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
    } catch (e) {
      // Silent fail to avoid infinite loops
    }
  }

  getLogs(level = null, limit = 100) {
    let filtered = level ? this.logs.filter(log => log.level === level) : this.logs;
    return filtered.slice(-limit);
  }

  clear() {
    this.logs = [];
  }

  setLevel(level) {
    this.currentLevel = this.levels[level] || this.levels.info;
  }
}

// Global logger instance
window.Logger = new Logger(process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
