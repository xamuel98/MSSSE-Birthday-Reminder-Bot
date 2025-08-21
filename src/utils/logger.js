const fs = require('fs');
const path = require('path');
const moment = require('moment');

class Logger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, 'bot.log');
        this.errorFile = path.join(this.logDir, 'error.log');
        this.debugMode = process.env.DEBUG === 'true';
        
        // Create logs directory if it doesn't exist
        this.ensureLogDirectory();
    }

    /**
     * Ensure logs directory exists
     */
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Get formatted timestamp
     */
    getTimestamp() {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }

    /**
     * Format log message
     */
    formatMessage(level, message, data = null) {
        const timestamp = this.getTimestamp();
        let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (data) {
            if (typeof data === 'object') {
                logMessage += ` | Data: ${JSON.stringify(data, null, 2)}`;
            } else {
                logMessage += ` | Data: ${data}`;
            }
        }
        
        return logMessage;
    }

    /**
     * Write to log file
     */
    writeToFile(filename, message) {
        try {
            fs.appendFileSync(filename, message + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Log info message
     */
    info(message, data = null) {
        const logMessage = this.formatMessage('INFO', message, data);
        console.log(`ℹ️  ${logMessage}`);
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log success message
     */
    success(message, data = null) {
        const logMessage = this.formatMessage('SUCCESS', message, data);
        console.log(`✅ ${logMessage}`);
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log warning message
     */
    warn(message, data = null) {
        const logMessage = this.formatMessage('WARN', message, data);
        console.warn(`⚠️  ${logMessage}`);
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log error message
     */
    error(message, error = null, data = null) {
        let errorData = data;
        
        if (error) {
            errorData = {
                ...data,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                }
            };
        }
        
        const logMessage = this.formatMessage('ERROR', message, errorData);
        console.error(`❌ ${logMessage}`);
        this.writeToFile(this.errorFile, logMessage);
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log debug message (only if debug mode is enabled)
     */
    debug(message, data = null) {
        if (!this.debugMode) return;
        
        const logMessage = this.formatMessage('DEBUG', message, data);
        console.log(`🐛 ${logMessage}`);
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log WhatsApp message
     */
    whatsapp(direction, from, to, message, data = null) {
        const logMessage = this.formatMessage('WHATSAPP', 
            `${direction.toUpperCase()} | From: ${from} | To: ${to} | Message: ${message}`, 
            data
        );
        console.log(`📱 ${logMessage}`);
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log command execution
     */
    command(user, group, command, args = [], success = true) {
        const status = success ? 'SUCCESS' : 'FAILED';
        const logMessage = this.formatMessage('COMMAND', 
            `${status} | User: ${user} | Group: ${group} | Command: ${command} | Args: ${args.join(' ')}`
        );
        
        if (success) {
            console.log(`🤖 ${logMessage}`);
        } else {
            console.error(`🤖 ${logMessage}`);
        }
        
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log birthday reminder
     */
    birthday(user, group, age, success = true) {
        const status = success ? 'SENT' : 'FAILED';
        const logMessage = this.formatMessage('BIRTHDAY', 
            `${status} | User: ${user} | Group: ${group} | Age: ${age}`
        );
        
        if (success) {
            console.log(`🎂 ${logMessage}`);
        } else {
            console.error(`🎂 ${logMessage}`);
        }
        
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log cron job execution
     */
    cron(jobName, status, message = '', data = null) {
        const logMessage = this.formatMessage('CRON', 
            `${jobName.toUpperCase()} | ${status.toUpperCase()} | ${message}`, 
            data
        );
        
        if (status === 'success') {
            console.log(`⏰ ${logMessage}`);
        } else {
            console.error(`⏰ ${logMessage}`);
        }
        
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Log database operation
     */
    database(operation, table, success = true, data = null) {
        const status = success ? 'SUCCESS' : 'FAILED';
        const logMessage = this.formatMessage('DATABASE', 
            `${status} | Operation: ${operation} | Table: ${table}`, 
            data
        );
        
        if (success && this.debugMode) {
            console.log(`💾 ${logMessage}`);
        } else if (!success) {
            console.error(`💾 ${logMessage}`);
        }
        
        this.writeToFile(this.logFile, logMessage);
    }

    /**
     * Clean old log files (keep last 7 days)
     */
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir);
            const cutoffDate = moment().subtract(7, 'days');
            
            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                const fileDate = moment(stats.mtime);
                
                if (fileDate.isBefore(cutoffDate)) {
                    fs.unlinkSync(filePath);
                    this.info(`Cleaned old log file: ${file}`);
                }
            });
        } catch (error) {
            this.error('Failed to clean old logs', error);
        }
    }

    /**
     * Get log file contents
     */
    getLogs(type = 'all', lines = 100) {
        try {
            let filename = this.logFile;
            
            if (type === 'error') {
                filename = this.errorFile;
            }
            
            if (!fs.existsSync(filename)) {
                return [];
            }
            
            const content = fs.readFileSync(filename, 'utf8');
            const logLines = content.split('\n').filter(line => line.trim());
            
            // Return last N lines
            return logLines.slice(-lines);
        } catch (error) {
            this.error('Failed to read log file', error);
            return [];
        }
    }

    /**
     * Get log statistics
     */
    getLogStats() {
        try {
            const logs = this.getLogs('all', 1000); // Get last 1000 lines
            const errors = this.getLogs('error', 1000);
            
            const today = moment().format('YYYY-MM-DD');
            const todayLogs = logs.filter(log => log.includes(today));
            const todayErrors = errors.filter(log => log.includes(today));
            
            return {
                total_logs: logs.length,
                total_errors: errors.length,
                today_logs: todayLogs.length,
                today_errors: todayErrors.length,
                log_file_size: this.getFileSize(this.logFile),
                error_file_size: this.getFileSize(this.errorFile)
            };
        } catch (error) {
            this.error('Failed to get log stats', error);
            return null;
        }
    }

    /**
     * Get file size in bytes
     */
    getFileSize(filename) {
        try {
            if (fs.existsSync(filename)) {
                const stats = fs.statSync(filename);
                return stats.size;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }
}

// Export singleton instance
const logger = new Logger();
module.exports = logger;

// Clean old logs on startup
logger.cleanOldLogs();