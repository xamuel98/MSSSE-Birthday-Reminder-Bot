const database = require('../database');
const crypto = require('crypto');
const moment = require('moment');

class ReminderRepository {
    /**
     * Create a new reminder record
     */
    async createReminder(birthdayId, reminderDate) {
        const reminderId = crypto.randomUUID();
        const sql = `
            INSERT INTO reminders (id, birthday_id, reminder_date, sent, sent_at)
            VALUES (?, ?, ?, false, NULL)
        `;
        return await database.run(sql, [reminderId, birthdayId, reminderDate]);
    }

    /**
     * Mark reminder as sent
     */
    async markReminderSent(reminderId) {
        const sql = `
            UPDATE reminders 
            SET sent = true, sent_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        return await database.run(sql, [reminderId]);
    }

    /**
     * Get pending reminders for a specific date
     */
    async getPendingReminders(date = null) {
        const reminderDate = date || moment().format('YYYY-MM-DD');
        const sql = `
            SELECT r.*, b.phone_number, b.birth_date, b.group_id, u.name, g.group_name
            FROM reminders r
            INNER JOIN birthdays b ON r.birthday_id = b.id
            LEFT JOIN users u ON b.phone_number = u.phone_number
            LEFT JOIN groups g ON b.group_id = g.group_id
            WHERE r.reminder_date = ? AND r.sent = false AND g.bot_active = true
            ORDER BY g.group_name, u.name
        `;
        return await database.all(sql, [reminderDate]);
    }

    /**
     * Get reminder by ID
     */
    async getReminderById(reminderId) {
        const sql = `
            SELECT r.*, b.phone_number, b.birth_date, b.group_id, u.name, g.group_name
            FROM reminders r
            INNER JOIN birthdays b ON r.birthday_id = b.id
            LEFT JOIN users u ON b.phone_number = u.phone_number
            LEFT JOIN groups g ON b.group_id = g.group_id
            WHERE r.id = ?
        `;
        return await database.get(sql, [reminderId]);
    }

    /**
     * Get all reminders for a birthday
     */
    async getRemindersByBirthday(birthdayId) {
        const sql = `
            SELECT * FROM reminders 
            WHERE birthday_id = ? 
            ORDER BY reminder_date DESC
        `;
        return await database.all(sql, [birthdayId]);
    }

    /**
     * Get reminder history for a group
     */
    async getReminderHistory(groupId, limit = 50) {
        const sql = `
            SELECT r.*, b.phone_number, b.birth_date, u.name
            FROM reminders r
            INNER JOIN birthdays b ON r.birthday_id = b.id
            LEFT JOIN users u ON b.phone_number = u.phone_number
            WHERE b.group_id = ? AND r.sent = true
            ORDER BY r.sent_at DESC
            LIMIT ?
        `;
        return await database.all(sql, [groupId, limit]);
    }

    /**
     * Check if reminder already exists for birthday and date
     */
    async reminderExists(birthdayId, reminderDate) {
        const sql = `
            SELECT 1 FROM reminders 
            WHERE birthday_id = ? AND reminder_date = ?
        `;
        const result = await database.get(sql, [birthdayId, reminderDate]);
        return !!result;
    }

    /**
     * Delete old reminders (cleanup)
     */
    async deleteOldReminders(daysOld = 365) {
        const cutoffDate = moment().subtract(daysOld, 'days').format('YYYY-MM-DD');
        const sql = `
            DELETE FROM reminders 
            WHERE reminder_date < ? AND sent = true
        `;
        return await database.run(sql, [cutoffDate]);
    }

    /**
     * Get reminder statistics
     */
    async getReminderStats(groupId = null, days = 30) {
        const startDate = moment().subtract(days, 'days').format('YYYY-MM-DD');
        let sql = `
            SELECT 
                COUNT(*) as total_reminders,
                COUNT(CASE WHEN r.sent = true THEN 1 END) as sent_reminders,
                COUNT(CASE WHEN r.sent = false THEN 1 END) as pending_reminders
            FROM reminders r
            INNER JOIN birthdays b ON r.birthday_id = b.id
            WHERE r.reminder_date >= ?
        `;
        const params = [startDate];
        
        if (groupId) {
            sql += ' AND b.group_id = ?';
            params.push(groupId);
        }
        
        return await database.get(sql, params);
    }

    /**
     * Create reminders for today's birthdays
     */
    async createTodaysReminders() {
        const today = moment().format('YYYY-MM-DD');
        const todayMD = moment().format('MM-DD');
        
        // Get all birthdays for today that don't have reminders yet
        const sql = `
            SELECT b.id as birthday_id
            FROM birthdays b
            INNER JOIN groups g ON b.group_id = g.group_id
            WHERE strftime('%m-%d', b.birth_date) = ? 
            AND g.bot_active = true
            AND NOT EXISTS (
                SELECT 1 FROM reminders r 
                WHERE r.birthday_id = b.id AND r.reminder_date = ?
            )
        `;
        
        const birthdays = await database.all(sql, [todayMD, today]);
        
        // Create reminders for each birthday
        const results = [];
        for (const birthday of birthdays) {
            const result = await this.createReminder(birthday.birthday_id, today);
            results.push(result);
        }
        
        return results;
    }
}

module.exports = new ReminderRepository();