const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.ERROR 
  : LOG_LEVELS.DEBUG;

class Logger {
  static error(message, meta = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.ERROR) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ERROR: ${message}`, meta);
    }
  }

  static warn(message, meta = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.WARN) {
      const timestamp = new Date().toISOString();
      console.warn(`[${timestamp}] WARN: ${message}`, meta);
    }
  }

  static info(message, meta = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.INFO) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] INFO: ${message}`, meta);
    }
  }

  static debug(message, meta = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] DEBUG: ${message}`, meta);
    }
  }

  static request(req, res, next) {
    if (process.env.NODE_ENV !== 'production') {
      Logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
    next();
  }
}

module.exports = Logger; 