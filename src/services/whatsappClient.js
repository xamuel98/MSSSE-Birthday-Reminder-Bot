const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { groupRepository, userRepository } = require('../database/repositories');

class WhatsAppClient {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.messageHandlers = [];
    }

    /**
     * Initialize WhatsApp client
     */
    async init() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'birthday-bot'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            }
        });

        this.setupEventHandlers();
        
        console.log('Starting WhatsApp client...');
        await this.client.initialize();
    }

    /**
     * Setup event handlers for WhatsApp client
     */
    setupEventHandlers() {
        // QR Code generation
        this.client.on('qr', (qr) => {
            console.log('\n=== WhatsApp QR Code ===');
            console.log('Scan this QR code with your WhatsApp mobile app:');
            qrcode.generate(qr, { small: true });
            console.log('========================\n');
        });

        // Client ready
        this.client.on('ready', async () => {
            console.log('✅ WhatsApp client is ready!');
            this.isReady = true;
            
            // Get client info
            const clientInfo = this.client.info;
            console.log(`Connected as: ${clientInfo.pushname} (${clientInfo.wid.user})`);
        });

        // Authentication success
        this.client.on('authenticated', () => {
            console.log('✅ WhatsApp authentication successful!');
        });

        // Authentication failure
        this.client.on('auth_failure', (msg) => {
            console.error('❌ WhatsApp authentication failed:', msg);
        });

        // Client disconnected
        this.client.on('disconnected', (reason) => {
            console.log('❌ WhatsApp client disconnected:', reason);
            this.isReady = false;
        });

        // Message received
        this.client.on('message', async (message) => {
            try {
                console.log("message: ", message);
                
                await this.handleMessage(message);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });

        // Group join
        this.client.on('group_join', async (notification) => {
            try {
                await this.handleGroupJoin(notification);
            } catch (error) {
                console.error('Error handling group join:', error);
            }
        });

        // Group leave
        this.client.on('group_leave', async (notification) => {
            try {
                await this.handleGroupLeave(notification);
            } catch (error) {
                console.error('Error handling group leave:', error);
            }
        });
    }

    /**
     * Handle incoming messages
     */
    async handleMessage(message) {
        // Skip if client not ready or message is from status
        if (!this.isReady || message.from === 'status@broadcast') {
            return;
        }

        // Get chat info
        const chat = await message.getChat();
        
        // Only process group messages
        if (!chat.isGroup) {
            return;
        }

        // Check if this is the target group (if TARGET_GROUP_ID is set)
        const targetGroupId = process.env.TARGET_GROUP_ID;
        if (targetGroupId && chat.id._serialized !== targetGroupId) {
            // Silently ignore messages from other groups
            return;
        }

        // Skip messages from the bot itself unless they are commands
        // This prevents infinite loops while allowing the bot to respond to its own commands
        if (message.fromMe && !message.body.trim().startsWith('/')) {
            return;
        }

        // Get contact info
        const contact = await message.getContact();
        const phoneNumber = contact.number;
        const name = contact.pushname || contact.name || phoneNumber;

        // Skip if phone number is null or undefined
        if (!phoneNumber) {
            console.warn('Skipping message processing: phoneNumber is null or undefined');
            return;
        }

        // Store/update user info
        await userRepository.createOrUpdateUser(phoneNumber, name);
        
        // Store/update group info
        await groupRepository.createOrUpdateGroup(chat.id._serialized, chat.name);
        
        // Add user to group if not already a member
        const isMember = await groupRepository.isMemberOfGroup(phoneNumber, chat.id._serialized);
        if (!isMember) {
            await groupRepository.addMemberToGroup(phoneNumber, chat.id._serialized, false);
        }

        // Process message through handlers
        for (const handler of this.messageHandlers) {
            try {
                await handler(message, chat, contact);
            } catch (error) {
                console.error('Error in message handler:', error);
            }
        }
    }

    /**
     * Handle group join events
     */
    async handleGroupJoin(notification) {
        const chat = await notification.getChat();
        
        // Store/update group info
        await groupRepository.createOrUpdateGroup(chat.id._serialized, chat.name);
        
        // Add new members to group
        for (const participant of notification.recipientIds) {
            const contact = await this.client.getContactById(participant);
            const phoneNumber = contact.number;
            const name = contact.pushname || contact.name || phoneNumber;
            
            // Skip if phone number is null or undefined
            if (!phoneNumber) {
                console.warn('Skipping group member addition: phoneNumber is null or undefined');
                continue;
            }
            
            await userRepository.createOrUpdateUser(phoneNumber, name);
            await groupRepository.addMemberToGroup(phoneNumber, chat.id._serialized, false);
        }
    }

    /**
     * Handle group leave events
     */
    async handleGroupLeave(notification) {
        const chat = await notification.getChat();
        
        // Remove members from group
        for (const participant of notification.recipientIds) {
            const contact = await this.client.getContactById(participant);
            const phoneNumber = contact.number;
            
            // Skip if phone number is null or undefined
            if (!phoneNumber) {
                console.warn('Skipping group member removal: phoneNumber is null or undefined');
                continue;
            }
            
            await groupRepository.removeMemberFromGroup(phoneNumber, chat.id._serialized);
        }
    }

    /**
     * Send message to a chat
     */
    async sendMessage(chatId, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp client is not ready');
        }
        
        try {
            await this.client.sendMessage(chatId, message);
            console.log(`Message sent to ${chatId}: ${message.substring(0, 50)}...`);
        } catch (error) {
            console.error(`Failed to send message to ${chatId}:`, error);
            throw error;
        }
    }

    /**
     * Send message with mentions
     */
    async sendMessageWithMentions(chatId, message, mentions = []) {
        if (!this.isReady) {
            throw new Error('WhatsApp client is not ready');
        }
        
        try {
            await this.client.sendMessage(chatId, message, { mentions });
            console.log(`Message with mentions sent to ${chatId}`);
        } catch (error) {
            console.error(`Failed to send message with mentions to ${chatId}:`, error);
            throw error;
        }
    }

    /**
     * Get chat by ID
     */
    async getChat(chatId) {
        if (!this.isReady) {
            throw new Error('WhatsApp client is not ready');
        }
        
        return await this.client.getChatById(chatId);
    }

    /**
     * Add message handler
     */
    addMessageHandler(handler) {
        this.messageHandlers.push(handler);
    }

    /**
     * Remove message handler
     */
    removeMessageHandler(handler) {
        const index = this.messageHandlers.indexOf(handler);
        if (index > -1) {
            this.messageHandlers.splice(index, 1);
        }
    }

    /**
     * Check if client is ready
     */
    isClientReady() {
        return this.isReady;
    }

    /**
     * Get client info
     */
    getClientInfo() {
        if (!this.isReady) {
            return null;
        }
        return this.client.info;
    }

    /**
     * Destroy client
     */
    async destroy() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
            console.log('WhatsApp client destroyed');
        }
    }
}

// Export singleton instance
const whatsappClient = new WhatsAppClient();
module.exports = whatsappClient;