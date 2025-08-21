require('dotenv').config();
const express = require('express');
const qrcode = require('qrcode-terminal');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

// Import services
const whatsappClient = require('./services/whatsappClient');
const commandParser = require('./services/commandParser');
const cronScheduler = require('./services/cronScheduler');
const database = require('./database/database');
const { userRepository, groupRepository } = require('./database/repositories');

class BirthdayReminderBot {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.isInitialized = false;
        this.startTime = new Date();
        this.currentQRCode = null; // Store current QR code for web access
        
        // Setup express middleware
        this.setupExpress();
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }

    /**
     * Initialize the bot
     */
    async initialize() {
        try {
            console.log('🤖 Starting Birthday Reminder Bot...');
            console.log('='.repeat(50));
            
            // Initialize database
            await this.initializeDatabase();
            
            // Initialize WhatsApp client
            await this.initializeWhatsApp();
            
            // Start cron scheduler
            this.startScheduler();
            
            // Start express server
            this.startServer();
            
            this.isInitialized = true;
            console.log('✅ Birthday Reminder Bot initialized successfully!');
            console.log('='.repeat(50));
            
        } catch (error) {
            console.error('❌ Failed to initialize bot:', error);
            process.exit(1);
        }
    }

    /**
     * Initialize database
     */
    async initializeDatabase() {
        console.log('📊 Initializing database...');
        
        try {
            await database.init();
            console.log('✅ Database initialized successfully');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize WhatsApp client
     */
    async initializeWhatsApp() {
        console.log('📱 Initializing WhatsApp client...');
        
        try {
            // Setup message handler
            whatsappClient.addMessageHandler(async (message, chat, contact) => {
                await this.handleMessage(message, chat, contact);
            });
            
            // Setup QR code handler for production
            whatsappClient.setQRCodeHandler((qrCode) => {
                this.currentQRCode = qrCode;
            });
            
            // Clear QR code when authenticated
            whatsappClient.setAuthenticatedHandler(() => {
                this.currentQRCode = null;
            });
            
            // Initialize client
            await whatsappClient.init();
            
            console.log('✅ WhatsApp client initialized successfully');
        } catch (error) {
            console.error('❌ WhatsApp client initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start cron scheduler
     */
    startScheduler() {
        console.log('⏰ Starting cron scheduler...');
        
        try {
            cronScheduler.start();
            console.log('✅ Cron scheduler started successfully');
        } catch (error) {
            console.error('❌ Failed to start cron scheduler:', error);
            throw error;
        }
    }

    /**
     * Start express server
     */
    startServer() {
        console.log(`🌐 Starting web server on port ${this.port}...`);
        
        this.server = this.app.listen(this.port, () => {
            console.log(`✅ Web server running on http://localhost:${this.port}`);
        });
    }

    /**
     * Setup express middleware and routes
     */
    setupExpress() {
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: Math.floor((new Date() - this.startTime) / 1000),
                timestamp: new Date().toISOString(),
                services: {
                    whatsapp: whatsappClient.isClientReady(),
                    scheduler: cronScheduler.getStatus(),
                    database: true
                }
            });
        });
        
        // Status endpoint
        this.app.get('/status', async (req, res) => {
            try {
                const stats = await this.getStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: 'Failed to get stats' });
            }
        });
        
        // Manual birthday check endpoint (for testing)
        this.app.post('/trigger/birthday-check', async (req, res) => {
            try {
                await cronScheduler.triggerBirthdayCheck();
                res.json({ message: 'Birthday check triggered successfully' });
            } catch (error) {
                res.status(500).json({ error: 'Failed to trigger birthday check' });
            }
        });
        
        // Manual reminder creation endpoint (for testing)
        this.app.post('/trigger/create-reminders', async (req, res) => {
            try {
                await cronScheduler.triggerReminderCreation();
                res.json({ message: 'Reminder creation triggered successfully' });
            } catch (error) {
                res.status(500).json({ error: 'Failed to trigger reminder creation' });
            }
        });
        
        // QR Code endpoint for production authentication
        this.app.get('/qr', (req, res) => {
            if (!this.currentQRCode) {
                return res.status(404).json({ 
                    error: 'No QR code available', 
                    message: 'WhatsApp client may already be authenticated or not yet initialized' 
                });
            }
            
            res.json({
                qrCode: this.currentQRCode,
                message: 'Use this QR code data with an online QR code generator to create a scannable code',
                instructions: [
                    '1. Copy the qrCode data below',
                    '2. Go to an online QR code generator (e.g., qr-code-generator.com)',
                    '3. Paste the data and generate the QR code',
                    '4. Scan with your WhatsApp mobile app'
                ]
            });
        });
        
        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                name: 'Birthday Reminder Bot',
                version: '1.0.0',
                description: 'WhatsApp bot for birthday reminders',
                endpoints: {
                    health: '/health',
                    status: '/status',
                    qr: '/qr (for production authentication)',
                    triggerBirthdayCheck: 'POST /trigger/birthday-check',
                    triggerCreateReminders: 'POST /trigger/create-reminders'
                }
            });
        });
    }

    /**
     * Handle incoming WhatsApp messages
     */
    async handleMessage(message, chat, contact) {
        try {
            
            // Only process group messages
            if (!chat.isGroup) {
                await message.reply(
                    '🤖 *Birthday Reminder Bot*\n\n' +
                    'Hi! I only work in WhatsApp groups.\n\n' +
                    'Please add me to a group and use commands like:\n' +
                    '• `/addbirthday DD/MM`\n' +
                    '• `/help` for more commands'
                );
                return;
            }
            
            // Check if this is the target group (if TARGET_GROUP_ID is set)
            const targetGroupId = process.env.TARGET_GROUP_ID;
            if (targetGroupId && chat.id._serialized !== targetGroupId) {
                // Silently ignore messages from other groups
                return;
            }
            
            // Log message for debugging
            console.log(`📨 Message from ${contact.pushname || contact.number} in ${chat.name} (Group ID: ${chat.id._serialized}): ${message.body}`);

            // Update user info
            await this.updateUserInfo(contact, chat);
            
            // Try to parse as command
            const isCommand = await commandParser.parseCommand(message, chat, contact);
            
            // If not a command and mentions the bot, show help
            if (!isCommand && message.body.toLowerCase().includes('birthday')) {
                await message.reply(
                    '🤖 *Birthday Reminder Bot*\n\n' +
                    'I help manage birthdays in this group!\n\n' +
                    'Use `/help` to see all available commands.'
                );
            }
            
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    /**
     * Handle group join events
     */
    async handleGroupJoin(notification) {
        try {
            const chat = await notification.getChat();
            const contact = await notification.getContact();
            
            console.log(`👥 User ${contact.pushname || contact.number} joined group ${chat.name}`);
            
            // Update group and user info
            await groupRepository.createOrUpdateGroup(chat.id._serialized, chat.name, true);
            await userRepository.createOrUpdateUser(contact.number, contact.pushname || contact.number);
            await groupRepository.addGroupMember(chat.id._serialized, contact.number, false);
            
            // Send welcome message
            const welcomeMessage = 
                `🎉 Welcome to the group, @${contact.number}!\n\n` +
                `🤖 I'm the Birthday Reminder Bot. I help keep track of everyone's birthdays!\n\n` +
                `📅 Add your birthday with: \`/addbirthday DD/MM\` (no year for privacy)\n` +
                `❓ Need help? Use: \`/help\``;
            
            await whatsappClient.sendMessage(chat.id._serialized, welcomeMessage);
            
        } catch (error) {
            console.error('Error handling group join:', error);
        }
    }

    /**
     * Handle group leave events
     */
    async handleGroupLeave(notification) {
        try {
            const chat = await notification.getChat();
            const contact = await notification.getContact();
            
            console.log(`👋 User ${contact.pushname || contact.number} left group ${chat.name}`);
            
            // Remove user from group
            await groupRepository.removeGroupMember(chat.id._serialized, contact.number);
            
        } catch (error) {
            console.error('Error handling group leave:', error);
        }
    }

    /**
     * Update user information
     */
    async updateUserInfo(contact, chat) {
        try {
            // Skip if contact number is null or undefined
            if (!contact.number) {
                console.warn('Skipping user info update: contact.number is null or undefined');
                return;
            }
            
            // Update user
            await userRepository.createOrUpdateUser(contact.number, contact.pushname || contact.number);
            
            // Update group
            await groupRepository.createOrUpdateGroup(chat.id._serialized, chat.name, true);
            
            // Add user to group if not already a member
            const isMember = await groupRepository.isMemberOfGroup(contact.number, chat.id._serialized);
            if (!isMember) {
                await groupRepository.addMemberToGroup(contact.number, chat.id._serialized, false);
            }
            
        } catch (error) {
            console.error('Error updating user info:', error);
        }
    }

    /**
     * Get bot statistics
     */
    async getStats() {
        try {
            const stats = await database.get(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM groups WHERE bot_active = 1) as active_groups,
                    (SELECT COUNT(*) FROM birthdays) as total_birthdays,
                    (SELECT COUNT(*) FROM reminders WHERE sent_at IS NULL) as pending_reminders,
                    (SELECT COUNT(*) FROM reminders WHERE sent_at IS NOT NULL) as sent_reminders
            `);
            
            return {
                bot: {
                    name: 'Birthday Reminder Bot',
                    version: '1.0.0',
                    uptime: Math.floor((new Date() - this.startTime) / 1000),
                    status: this.isInitialized ? 'running' : 'initializing'
                },
                services: {
                    whatsapp: {
                        ready: whatsappClient.isClientReady(),
                        status: whatsappClient.isClientReady() ? 'connected' : 'disconnected'
                    },
                    scheduler: cronScheduler.getStatus(),
                    database: {
                        connected: true,
                        status: 'connected'
                    }
                },
                statistics: stats || {
                    total_users: 0,
                    active_groups: 0,
                    total_birthdays: 0,
                    pending_reminders: 0,
                    sent_reminders: 0
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            throw error;
        }
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
            try {
                // Stop cron scheduler
                if (cronScheduler.getStatus().isRunning) {
                    cronScheduler.stop();
                    console.log('✅ Cron scheduler stopped');
                }
                
                // Close WhatsApp client
                if (whatsappClient.isClientReady()) {
                    await whatsappClient.destroy();
                    console.log('✅ WhatsApp client closed');
                }
                
                // Close database connection
                await database.close();
                console.log('✅ Database connection closed');
                
                // Close express server
                if (this.server) {
                    this.server.close(() => {
                        console.log('✅ Web server closed');
                        console.log('👋 Birthday Reminder Bot shut down successfully');
                        process.exit(0);
                    });
                } else {
                    console.log('👋 Birthday Reminder Bot shut down successfully');
                    process.exit(0);
                }
                
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };
        
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }
}

// Create and start the bot
const bot = new BirthdayReminderBot();

// Start the bot
bot.initialize().catch((error) => {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
});

// Export for testing
module.exports = BirthdayReminderBot;