const cron = require('node-cron');
const moment = require('moment');
const { birthdayRepository, reminderRepository } = require('../database/repositories');
const whatsappClient = require('./whatsappClient');

class CronScheduler {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
    }

    /**
     * Start all scheduled jobs
     */
    start() {
        if (this.isRunning) {
            console.log('Cron scheduler is already running');
            return;
        }

        console.log('Starting cron scheduler...');
        
        // Schedule birthday check at 12:00 AM every day
        this.scheduleBirthdayCheck();
        
        // Schedule cleanup job at 2:00 AM every day
        this.scheduleCleanupJob();
        
        // Schedule reminder creation at 11:59 PM every day
        this.scheduleReminderCreation();
        
        this.isRunning = true;
        console.log('Cron scheduler started successfully');
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        if (!this.isRunning) {
            console.log('Cron scheduler is not running');
            return;
        }

        console.log('Stopping cron scheduler...');
        
        // Stop all jobs
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`Stopped job: ${name}`);
        });
        
        this.jobs.clear();
        this.isRunning = false;
        console.log('Cron scheduler stopped');
    }

    /**
     * Schedule birthday check job - runs at 12:00 AM every day
     */
    scheduleBirthdayCheck() {
        const job = cron.schedule('0 0 * * *', async () => {
            console.log('Running daily birthday check at:', new Date().toISOString());
            await this.checkTodaysBirthdays();
        }, {
            scheduled: false,
            timezone: 'Africa/Lagos' // Adjust timezone as needed
        });

        this.jobs.set('birthdayCheck', job);
        job.start();
        console.log('Scheduled birthday check job for 12:00 AM daily');
    }

    /**
     * Schedule reminder creation job - runs at 11:59 PM every day
     */
    scheduleReminderCreation() {
        const job = cron.schedule('59 23 * * *', async () => {
            console.log('Creating reminders for tomorrow at:', new Date().toISOString());
            await this.createTomorrowReminders();
        }, {
            scheduled: false,
            timezone: 'Africa/Lagos'
        });

        this.jobs.set('reminderCreation', job);
        job.start();
        console.log('Scheduled reminder creation job for 11:59 PM daily');
    }

    /**
     * Schedule cleanup job - runs at 2:00 AM every day
     */
    scheduleCleanupJob() {
        const job = cron.schedule('0 2 * * *', async () => {
            console.log('Running cleanup job at:', new Date().toISOString());
            await this.cleanupOldReminders();
        }, {
            scheduled: false,
            timezone: 'Africa/Lagos'
        });

        this.jobs.set('cleanup', job);
        job.start();
        console.log('Scheduled cleanup job for 2:00 AM daily');
    }

    /**
     * Check and send birthday reminders for today
     */
    async checkTodaysBirthdays() {
        try {
            console.log('Checking today\'s birthdays...');
            
            // Get all pending reminders for today
            const pendingReminders = await reminderRepository.getPendingReminders();
            
            if (pendingReminders.length === 0) {
                console.log('No pending birthday reminders for today');
                return;
            }

            console.log(`Found ${pendingReminders.length} pending birthday reminders`);

            // Process each reminder
            for (const reminder of pendingReminders) {
                await this.processBirthdayReminder(reminder);
                
                // Add small delay between messages to avoid rate limiting
                await this.delay(1000);
            }

            console.log('Completed processing all birthday reminders');
        } catch (error) {
            console.error('Error checking today\'s birthdays:', error);
        }
    }

    /**
     * Process individual birthday reminder
     */
    async processBirthdayReminder(reminder) {
        try {
            const { id, group_id, phone_number, name, birth_date } = reminder;
            
            console.log(`Processing birthday reminder for ${name} (${phone_number}) in group ${group_id}`);
            
            // Create birthday message (without age for privacy)
            const message = this.createBirthdayMessage(name, phone_number);
            
            // Send message to group
            await whatsappClient.sendMessage(group_id, message);
            
            // Mark reminder as sent
            await reminderRepository.markReminderAsSent(id);
            
            console.log(`Birthday reminder sent successfully for ${name}`);
        } catch (error) {
            console.error(`Error processing birthday reminder for ${reminder.name}:`, error);
        }
    }

    /**
     * Create birthday message with user tagging (no age for privacy)
     */
    createBirthdayMessage(name, phoneNumber) {
        const messages = [
            `🎉🎂 *HAPPY BIRTHDAY* 🎂🎉\n\n@${phoneNumber} is celebrating their special day today!\n\n🎊 Wishing you a fantastic day filled with happiness and joy! 🎊`,
            `🎈🎉 *BIRTHDAY CELEBRATION* 🎉🎈\n\n@${phoneNumber} has a birthday today!\n\n🎂 May your special day be filled with wonderful moments and sweet memories! 🎂`,
            `🎊🎁 *SPECIAL DAY ALERT* 🎁🎊\n\n@${phoneNumber} is celebrating today!\n\n🌟 Hope your birthday is as amazing as you are! 🌟`,
            `🎉🎵 *BIRTHDAY WISHES* 🎵🎉\n\n@${phoneNumber} celebrates their birthday today!\n\n🎂 Have a wonderful birthday filled with love and laughter! 🎂`
        ];
        
        // Select random message
        const randomIndex = Math.floor(Math.random() * messages.length);
        return messages[randomIndex];
    }



    /**
     * Create reminders for tomorrow's birthdays
     */
    async createTomorrowReminders() {
        try {
            console.log('Creating reminders for tomorrow\'s birthdays...');
            
            const tomorrow = moment().add(1, 'day').format('MM-DD');
            const remindersCreated = await reminderRepository.createRemindersForDate(tomorrow);
            
            console.log(`Created ${remindersCreated} reminders for tomorrow (${tomorrow})`);
        } catch (error) {
            console.error('Error creating tomorrow\'s reminders:', error);
        }
    }

    /**
     * Clean up old reminders (older than 7 days)
     */
    async cleanupOldReminders() {
        try {
            console.log('Cleaning up old reminders...');
            
            const deletedCount = await reminderRepository.deleteOldReminders(7);
            
            console.log(`Cleaned up ${deletedCount} old reminders`);
        } catch (error) {
            console.error('Error cleaning up old reminders:', error);
        }
    }

    /**
     * Manual trigger for birthday check (for testing)
     */
    async triggerBirthdayCheck() {
        console.log('Manually triggering birthday check...');
        await this.checkTodaysBirthdays();
    }

    /**
     * Manual trigger for reminder creation (for testing)
     */
    async triggerReminderCreation() {
        console.log('Manually triggering reminder creation...');
        await this.createTomorrowReminders();
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: Array.from(this.jobs.keys()),
            jobCount: this.jobs.size
        };
    }

    /**
     * Utility function to add delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Schedule a one-time job for testing
     */
    scheduleTestJob(delayMinutes = 1) {
        const testTime = moment().add(delayMinutes, 'minutes');
        const cronExpression = `${testTime.minute()} ${testTime.hour()} * * *`;
        
        console.log(`Scheduling test job for ${testTime.format('HH:mm')}`);
        
        const job = cron.schedule(cronExpression, async () => {
            console.log('Test job executed at:', new Date().toISOString());
            await this.checkTodaysBirthdays();
            
            // Remove the test job after execution
            this.jobs.delete('test');
        }, {
            scheduled: false
        });
        
        this.jobs.set('test', job);
        job.start();
        
        return `Test job scheduled for ${testTime.format('HH:mm')}`;
    }
}

// Export singleton instance
const cronScheduler = new CronScheduler();
module.exports = cronScheduler;

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Received SIGINT, stopping cron scheduler...');
    cronScheduler.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, stopping cron scheduler...');
    cronScheduler.stop();
    process.exit(0);
});