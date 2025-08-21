const database = require('../database');
const crypto = require('crypto');
const moment = require('moment');

class BirthdayRepository {
    /**
     * Add or update a birthday
     */
    async addOrUpdateBirthday(phoneNumber, birthDate, groupId) {
        // Check if birthday already exists for this user in this group
        const existingBirthday = await this.getBirthdayByUserAndGroup(phoneNumber, groupId);
        
        if (existingBirthday) {
            // Update existing birthday
            const sql = `
                UPDATE birthdays 
                SET birth_date = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE phone_number = ? AND group_id = ?
            `;
            return await database.run(sql, [birthDate, phoneNumber, groupId]);
        } else {
            // Create new birthday
            const birthdayId = crypto.randomUUID();
            const sql = `
                INSERT INTO birthdays (id, phone_number, birth_date, group_id)
                VALUES (?, ?, ?, ?)
            `;
            return await database.run(sql, [birthdayId, phoneNumber, birthDate, groupId]);
        }
    }

    /**
     * Get birthday by user and group
     */
    async getBirthdayByUserAndGroup(phoneNumber, groupId) {
        const sql = `
            SELECT b.*, u.name 
            FROM birthdays b
            LEFT JOIN users u ON b.phone_number = u.phone_number
            WHERE b.phone_number = ? AND b.group_id = ?
        `;
        return await database.get(sql, [phoneNumber, groupId]);
    }

    /**
     * Get all birthdays for a group
     */
    async getBirthdaysByGroup(groupId) {
        const sql = `
            SELECT b.*, u.name 
            FROM birthdays b
            LEFT JOIN users u ON b.phone_number = u.phone_number
            WHERE b.group_id = ?
            ORDER BY strftime('%m-%d', b.birth_date)
        `;
        return await database.all(sql, [groupId]);
    }

    /**
     * Get birthdays for today
     */
    async getTodaysBirthdays(groupId = null) {
        const today = moment().format('MM-DD');
        let sql = `
            SELECT b.*, u.name, g.group_name
            FROM birthdays b
            LEFT JOIN users u ON b.phone_number = u.phone_number
            LEFT JOIN groups g ON b.group_id = g.group_id
            WHERE strftime('%m-%d', b.birth_date) = ?
        `;
        const params = [today];
        
        if (groupId) {
            sql += ' AND b.group_id = ?';
            params.push(groupId);
        }
        
        sql += ' AND g.bot_active = true';
        
        return await database.all(sql, params);
    }

    /**
     * Get upcoming birthdays (next 30 days)
     */
    async getUpcomingBirthdays(groupId, days = 30) {
        const sql = `
            SELECT b.*, u.name,
                   CASE 
                       WHEN strftime('%m-%d', b.birth_date) >= strftime('%m-%d', 'now') 
                       THEN date('now', '+' || (julianday(strftime('%Y', 'now') || '-' || strftime('%m-%d', b.birth_date)) - julianday('now')) || ' days')
                       ELSE date('now', '+' || (julianday(strftime('%Y', 'now', '+1 year') || '-' || strftime('%m-%d', b.birth_date)) - julianday('now')) || ' days')
                   END as next_birthday
            FROM birthdays b
            LEFT JOIN users u ON b.phone_number = u.phone_number
            WHERE b.group_id = ?
            ORDER BY next_birthday
            LIMIT ?
        `;
        return await database.all(sql, [groupId, days]);
    }

    /**
     * Remove birthday
     */
    async removeBirthday(phoneNumber, groupId) {
        const sql = 'DELETE FROM birthdays WHERE phone_number = ? AND group_id = ?';
        return await database.run(sql, [phoneNumber, groupId]);
    }

    /**
     * Get birthday by ID
     */
    async getBirthdayById(birthdayId) {
        const sql = `
            SELECT b.*, u.name 
            FROM birthdays b
            LEFT JOIN users u ON b.phone_number = u.phone_number
            WHERE b.id = ?
        `;
        return await database.get(sql, [birthdayId]);
    }

    /**
     * Check if user has birthday in group
     */
    async hasBirthdayInGroup(phoneNumber, groupId) {
        const birthday = await this.getBirthdayByUserAndGroup(phoneNumber, groupId);
        return !!birthday;
    }

    /**
     * Get all birthdays for a user across all groups
     */
    async getBirthdaysByUser(phoneNumber) {
        const sql = `
            SELECT b.*, u.name, g.group_name 
            FROM birthdays b
            LEFT JOIN users u ON b.phone_number = u.phone_number
            LEFT JOIN groups g ON b.group_id = g.group_id
            WHERE b.phone_number = ?
            ORDER BY g.group_name
        `;
        return await database.all(sql, [phoneNumber]);
    }

    /**
     * Get birthday statistics for a group
     */
    async getBirthdayStats(groupId) {
        const sql = `
            SELECT 
                COUNT(*) as total_birthdays,
                COUNT(CASE WHEN strftime('%m', b.birth_date) = strftime('%m', 'now') THEN 1 END) as this_month,
                COUNT(CASE WHEN strftime('%m-%d', b.birth_date) = strftime('%m-%d', 'now') THEN 1 END) as today
            FROM birthdays b
            WHERE b.group_id = ?
        `;
        return await database.get(sql, [groupId]);
    }
}

module.exports = new BirthdayRepository();