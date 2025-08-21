const moment = require('moment');
const { birthdayRepository, groupRepository } = require('../database/repositories');
const whatsappClient = require('./whatsappClient');

class CommandParser {
    constructor() {
        this.commands = {
            '/addbirthday': this.handleAddBirthday.bind(this),
            '/removebirthday': this.handleRemoveBirthday.bind(this),
            '/listbirthdays': this.handleListBirthdays.bind(this),
            '/help': this.handleHelp.bind(this),
            '/birthday': this.handleAddBirthday.bind(this), // Alias
            '/mybirthday': this.handleMyBirthday.bind(this),
            '/upcoming': this.handleUpcoming.bind(this),
            '/stats': this.handleStats.bind(this)
        };
    }

    /**
     * Parse and execute command from message
     */
    async parseCommand(message, chat, contact) {
        const messageBody = message.body.trim();
        
        // Check if message starts with a command
        if (!messageBody.startsWith('/')) {
            return false;
        }

        // Extract command and arguments
        const parts = messageBody.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Check if command exists
        if (!this.commands[command]) {
            await this.sendUnknownCommandMessage(chat.id._serialized);
            return true;
        }

        try {
            // Execute command
            await this.commands[command](message, chat, contact, args);
            return true;
        } catch (error) {
            console.error(`Error executing command ${command}:`, error);
            await this.sendErrorMessage(chat.id._serialized, 'Sorry, there was an error processing your command. Please try again.');
            return true;
        }
    }

    /**
     * Handle /addbirthday command
     */
    async handleAddBirthday(message, chat, contact, args) {
        if (args.length === 0) {
            await this.sendMessage(chat.id._serialized, 
                '📅 *Add Birthday Command*\n\n' +
                'Usage: `/addbirthday DD/MM`\n\n' +
                'Examples:\n' +
                '• `/addbirthday 15/03`\n' +
                '• `/addbirthday 01/12`\n\n' +
                'Please provide your birth date in DD/MM format.'
            );
            return;
        }

        const dateStr = args[0];
        const phoneNumber = contact.number;
        const groupId = chat.id._serialized;

        // Validate date format
        const validation = this.validateDate(dateStr);
        if (!validation.isValid) {
            await this.sendMessage(chat.id._serialized,
                '❌ *Invalid Date Format*\n\n' +
                'Please use DD/MM format.\n\n' +
                'Examples:\n' +
                '• `/addbirthday 15/03`\n' +
                '• `/addbirthday 01/12`'
            );
            return;
        }
        
        const birthDate = validation.date.format('YYYY-MM-DD');

        try {
            // Add birthday to database
            await birthdayRepository.addOrUpdateBirthday(phoneNumber, birthDate, groupId);
            
            const formattedDate = moment(birthDate).format('DD MMMM');
            await this.sendMessage(chat.id._serialized,
                `🎉 *Birthday Added Successfully!*\n\n` +
                `📅 Your birthday: ${formattedDate}\n\n` +
                `I'll remind the group on your special day! 🎂`
            );
        } catch (error) {
            console.error('Error adding birthday:', error);
            await this.sendErrorMessage(chat.id._serialized, 'Failed to add your birthday. Please try again.');
        }
    }

    /**
     * Handle /removebirthday command
     */
    async handleRemoveBirthday(message, chat, contact, args) {
        const phoneNumber = contact.number;
        const groupId = chat.id._serialized;

        try {
            // Check if user has a birthday in this group
            const hasBirthday = await birthdayRepository.hasBirthdayInGroup(phoneNumber, groupId);
            
            if (!hasBirthday) {
                await this.sendMessage(chat.id._serialized,
                    '❌ *No Birthday Found*\n\n' +
                    'You don\'t have a birthday registered in this group.\n\n' +
                    'Use `/addbirthday DD/MM` to add your birthday.'
                );
                return;
            }

            // Remove birthday
            await birthdayRepository.removeBirthday(phoneNumber, groupId);
            
            await this.sendMessage(chat.id._serialized,
                '✅ *Birthday Removed*\n\n' +
                'Your birthday has been removed from this group.\n\n' +
                'You can add it back anytime using `/addbirthday DD/MM`.'
            );
        } catch (error) {
            console.error('Error removing birthday:', error);
            await this.sendErrorMessage(chat.id._serialized, 'Failed to remove your birthday. Please try again.');
        }
    }

    /**
     * Handle /listbirthdays command
     */
    async handleListBirthdays(message, chat, contact, args) {
        const groupId = chat.id._serialized;

        try {
            const birthdays = await birthdayRepository.getBirthdaysByGroup(groupId);
            
            if (birthdays.length === 0) {
                await this.sendMessage(chat.id._serialized,
                    '📅 *No Birthdays Yet*\n\n' +
                    'No one has added their birthday to this group yet.\n\n' +
                    'Use `/addbirthday DD/MM` to add yours!'
                );
                return;
            }

            // Sort birthdays by month and day
            const sortedBirthdays = birthdays.sort((a, b) => {
                const dateA = moment(a.birth_date, 'YYYY-MM-DD');
                const dateB = moment(b.birth_date, 'YYYY-MM-DD');
                return dateA.format('MM-DD').localeCompare(dateB.format('MM-DD'));
            });

            let message = '🎂 *Group Birthdays*\n\n';
            
            sortedBirthdays.forEach((birthday, index) => {
                const date = moment(birthday.birth_date);
                const name = birthday.name || 'Unknown';
                const formattedDate = date.format('DD MMM');
                
                // Calculate next birthday
                const nextBirthday = this.getNextBirthdayDate(date);
                const daysUntil = nextBirthday.diff(moment(), 'days');
                
                let dayText = '';
                if (daysUntil === 0) {
                    dayText = ' 🎉 *TODAY!*';
                } else if (daysUntil === 1) {
                    dayText = ' 🔜 *Tomorrow*';
                } else if (daysUntil <= 7) {
                    dayText = ` 🔜 *${daysUntil} days*`;
                }
                
                message += `${index + 1}. ${name} - ${formattedDate}${dayText}\n`;
            });
            
            message += '\n💡 Use `/upcoming` to see upcoming birthdays only.';
            
            await this.sendMessage(chat.id._serialized, message);
        } catch (error) {
            console.error('Error listing birthdays:', error);
            await this.sendErrorMessage(chat.id._serialized, 'Failed to get birthday list. Please try again.');
        }
    }

    /**
     * Handle /mybirthday command
     */
    async handleMyBirthday(message, chat, contact, args) {
        const phoneNumber = contact.number;
        const groupId = chat.id._serialized;

        try {
            const birthday = await birthdayRepository.getBirthdayByUserAndGroup(phoneNumber, groupId);
            
            if (!birthday) {
                await this.sendMessage(chat.id._serialized,
                    '❌ *No Birthday Found*\n\n' +
                    'You haven\'t added your birthday to this group yet.\n\n' +
                    'Use `/addbirthday DD/MM` to add it!'
                );
                return;
            }

            const date = moment(birthday.birth_date);
            const formattedDate = date.format('DD MMMM');
            const nextBirthday = this.getNextBirthdayDate(date);
            const daysUntil = nextBirthday.diff(moment(), 'days');
            
            let message = `🎂 *Your Birthday*\n\n📅 ${formattedDate}\n\n`;
            
            if (daysUntil === 0) {
                message += '🎉 *Happy Birthday! It\'s your special day!* 🎉';
            } else if (daysUntil === 1) {
                message += '🔜 *Tomorrow is your birthday!* 🎂';
            } else {
                message += `⏰ ${daysUntil} days until your next birthday!`;
            }
            
            await this.sendMessage(chat.id._serialized, message);
        } catch (error) {
            console.error('Error getting user birthday:', error);
            await this.sendErrorMessage(chat.id._serialized, 'Failed to get your birthday info. Please try again.');
        }
    }

    /**
     * Handle /upcoming command
     */
    async handleUpcoming(message, chat, contact, args) {
        const groupId = chat.id._serialized;
        const days = args[0] ? parseInt(args[0]) : 30;

        if (isNaN(days) || days < 1 || days > 365) {
            await this.sendMessage(chat.id._serialized,
                '❌ *Invalid Days*\n\n' +
                'Please provide a number between 1 and 365.\n\n' +
                'Usage: `/upcoming [days]`\n' +
                'Example: `/upcoming 7` (next 7 days)'
            );
            return;
        }

        try {
            const birthdays = await birthdayRepository.getUpcomingBirthdays(groupId, days);
            
            if (birthdays.length === 0) {
                await this.sendMessage(chat.id._serialized,
                    `📅 *No Upcoming Birthdays*\n\n` +
                    `No birthdays in the next ${days} days.`
                );
                return;
            }

            let message = `🔜 *Upcoming Birthdays (${days} days)*\n\n`;
            
            birthdays.forEach((birthday, index) => {
                const date = moment(birthday.birth_date);
                const name = birthday.name || 'Unknown';
                const nextBirthday = this.getNextBirthdayDate(date);
                const daysUntil = nextBirthday.diff(moment(), 'days');
                const formattedDate = date.format('DD MMM');
                
                let dayText = '';
                if (daysUntil === 0) {
                    dayText = ' 🎉 *TODAY!*';
                } else if (daysUntil === 1) {
                    dayText = ' 🔜 *Tomorrow*';
                } else {
                    dayText = ` 🔜 *${daysUntil} days*`;
                }
                
                message += `${index + 1}. ${name} - ${formattedDate}${dayText}\n`;
            });
            
            await this.sendMessage(chat.id._serialized, message);
        } catch (error) {
            console.error('Error getting upcoming birthdays:', error);
            await this.sendErrorMessage(chat.id._serialized, 'Failed to get upcoming birthdays. Please try again.');
        }
    }

    /**
     * Handle /stats command
     */
    async handleStats(message, chat, contact, args) {
        const groupId = chat.id._serialized;

        try {
            const stats = await birthdayRepository.getBirthdayStats(groupId);
            const groupInfo = await groupRepository.getGroupById(groupId);
            
            let message = `📊 *Birthday Statistics*\n\n`;
            message += `👥 Group: ${groupInfo?.group_name || 'Unknown'}\n`;
            message += `🎂 Total Birthdays: ${stats.total_birthdays}\n`;
            message += `📅 This Month: ${stats.this_month}\n`;
            message += `🎉 Today: ${stats.today}\n\n`;
            
            if (stats.today > 0) {
                message += '🎊 *Happy Birthday to today\'s celebrants!* 🎊';
            } else if (stats.this_month > 0) {
                message += '🔜 *Birthdays coming up this month!*';
            } else {
                message += '💡 *Use `/addbirthday DD/MM` to add your birthday!*';
            }
            
            await this.sendMessage(chat.id._serialized, message);
        } catch (error) {
            console.error('Error getting birthday stats:', error);
            await this.sendErrorMessage(chat.id._serialized, 'Failed to get birthday statistics. Please try again.');
        }
    }

    /**
     * Handle /help command
     */
    async handleHelp(message, chat, contact, args) {
        const helpMessage = 
            '🤖 *Birthday Reminder Bot Help*\n\n' +
            '*Available Commands:*\n\n' +
            '📅 `/addbirthday DD/MM` - Add your birthday\n' +
            '❌ `/removebirthday` - Remove your birthday\n' +
            '📋 `/listbirthdays` - Show all birthdays\n' +
            '👤 `/mybirthday` - Show your birthday info\n' +
            '🔜 `/upcoming [days]` - Show upcoming birthdays\n' +
            '📊 `/stats` - Show birthday statistics\n' +
            '❓ `/help` - Show this help message\n\n' +
            '*Examples:*\n' +
            '• `/addbirthday 15/03`\n' +
            '• `/upcoming 7` (next 7 days)\n\n' +
            '*Features:*\n' +
            '🎂 Automatic birthday reminders at 12 AM\n' +
            '🏷️ Tags birthday person in group\n' +
            '📱 Works in WhatsApp groups only\n\n' +
            '💡 *Tip:* All dates should be in DD/MM format!';
        
        await this.sendMessage(chat.id._serialized, helpMessage);
    }

    /**
     * Validates date format and creates a birthday date
     * @param {string} dateStr - Date string to validate (DD/MM format)
     * @returns {Object} - {isValid: boolean, date: moment object, error: string}
     */
    validateDate(dateStr) {
        const formats = ['DD/MM', 'DD-MM', 'DD.MM'];
        let date = null;
        let isValidFormat = false;

        // Try each format
        for (const format of formats) {
            date = moment(dateStr, format, true);
            if (date.isValid()) {
                isValidFormat = true;
                break;
            }
        }

        if (!isValidFormat) {
            return {
                isValid: false,
                date: null,
                error: 'Invalid date format. Please use DD/MM, DD-MM, or DD.MM'
            };
        }

        // Set year to current year for storage
        const currentYear = moment().year();
        date.year(currentYear);

        return {
            isValid: true,
            date: date,
            error: null
        };
    }

    /**
     * Get next birthday date for a given birth date
     */
    getNextBirthdayDate(birthDate) {
        const now = moment();
        const thisYear = now.year();
        const nextBirthday = moment(birthDate).year(thisYear);
        
        // If birthday has passed this year, use next year
        if (nextBirthday.isBefore(now, 'day')) {
            nextBirthday.add(1, 'year');
        }
        
        return nextBirthday;
    }

    /**
     * Send message helper
     */
    async sendMessage(chatId, message) {
        await whatsappClient.sendMessage(chatId, message);
    }

    /**
     * Send error message
     */
    async sendErrorMessage(chatId, errorMsg) {
        const message = `❌ *Error*\n\n${errorMsg}\n\nUse \`/help\` for available commands.`;
        await this.sendMessage(chatId, message);
    }

    /**
     * Send unknown command message
     */
    async sendUnknownCommandMessage(chatId) {
        const message = 
            '❓ *Unknown Command*\n\n' +
            'I don\'t recognize that command.\n\n' +
            'Use `/help` to see all available commands.';
        await this.sendMessage(chatId, message);
    }
}

// Export singleton instance
const commandParser = new CommandParser();
module.exports = commandParser;