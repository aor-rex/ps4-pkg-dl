const fs = require('fs');
const path = require('path');

// Log levels
const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ANSI colors for console
const COLORS = {
  debug: '\x1b[36m',   // Cyan
  info: '\x1b[32m',    // Green
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  reset: '\x1b[0m',
};

class Logger {
  /**
   * @param {Object} options
   * @param {string} [options.logDir] - Log directory
   * @param {string} [options.level='info'] - Minimum log level
   * @param {boolean} [options.console=true] - Also log to console
   * @param {number} [options.maxFileSize=10485760] - Max log file size (10MB)
   * @param {number} [options.maxFiles=5] - Max log files to keep
   */
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(require('./settings').getConfigDir(), 'logs');
    this.minLevel = options.level || 'info';
    this.console = options.console !== false;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logFile = path.join(this.logDir, 'app.log');
  }
  
  /**
   * Log a debug message
   */
  debug(message, ...args) {
    this.log('debug', message, ...args);
  }
  
  /**
   * Log an info message
   */
  info(message, ...args) {
    this.log('info', message, ...args);
  }
  
  /**
   * Log a warning
   */
  warn(message, ...args) {
    this.log('warn', message, ...args);
  }
  
  /**
   * Log an error
   */
  error(message, ...args) {
    this.log('error', message, ...args);
  }
  
  /**
   * Internal log method
   */
  log(level, message, ...args) {
    if (LEVELS[level] < LEVELS[this.minLevel]) {
      return;
    }
    
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Write to file
    this.writeToFile(line);
    
    // Write to console
    if (this.console) {
      const color = COLORS[level] || '';
      const reset = COLORS.reset;
      
      if (level === 'error') {
        console.error(`${color}${line}${reset}`, ...args);
      } else if (level === 'warn') {
        console.warn(`${color}${line}${reset}`, ...args);
      } else {
        console.log(`${color}${line}${reset}`, ...args);
      }
    }
  }
  
  /**
   * Write to log file with rotation
   */
  writeToFile(line) {
    try {
      // Check file size and rotate if needed
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size >= this.maxFileSize) {
          this.rotateLogs();
        }
      }
      
      fs.appendFileSync(this.logFile, line + '\n');
    } catch (error) {
      // If we can't write to log file, print to console
      console.error(`[logger] Failed to write to log file: ${error.message}`);
    }
  }
  
  /**
   * Rotate log files
   */
  rotateLogs() {
    try {
      // Delete oldest file if we have max files
      const files = [];
      for (let i = 0; i < this.maxFiles; i++) {
        const file = i === 0 ? this.logFile : `${this.logFile}.${i}`;
        if (fs.existsSync(file)) {
          files.push(file);
        }
      }
      
      if (files.length >= this.maxFiles) {
        fs.unlinkSync(files[files.length - 1]);
      }
      
      // Shift files
      for (let i = files.length - 1; i > 0; i--) {
        const oldPath = files[i - 1];
        const newPath = `${this.logFile}.${i}`;
        fs.renameSync(oldPath, newPath);
      }
      
      // Current log becomes .1
      if (files.length > 0) {
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
    } catch (error) {
      console.error(`[logger] Failed to rotate logs: ${error.message}`);
    }
  }
  
  /**
   * Get log file path
   */
  getLogDir() {
    return this.logDir;
  }
  
  /**
   * Clear all log files
   */
  clearLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.truncateSync(this.logFile, 0);
      }
      for (let i = 1; i <= this.maxFiles; i++) {
        const file = `${this.logFile}.${i}`;
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }
    } catch (error) {
      console.error(`[logger] Failed to clear logs: ${error.message}`);
    }
  }
  
  /**
   * Get log file size
   */
  getLogSize() {
    let total = 0;
    try {
      if (fs.existsSync(this.logFile)) {
        total += fs.statSync(this.logFile).size;
      }
      for (let i = 1; i <= this.maxFiles; i++) {
        const file = `${this.logFile}.${i}`;
        if (fs.existsSync(file)) {
          total += fs.statSync(file).size;
        }
      }
    } catch (error) {
      // Ignore
    }
    return total;
  }
}

module.exports = { Logger };
