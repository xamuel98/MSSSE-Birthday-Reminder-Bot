const database = require('../database');

class UserRepository {
    /**
     * Create or update a user
     */
    async createOrUpdateUser(phoneNumber, name) {
        const sql = `
            INSERT OR REPLACE INTO users (phone_number, name, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `;
        return await database.run(sql, [phoneNumber, name]);
    }

    /**
     * Get user by phone number
     */
    async getUserByPhone(phoneNumber) {
        const sql = 'SELECT * FROM users WHERE phone_number = ?';
        return await database.get(sql, [phoneNumber]);
    }

    /**
     * Get all users
     */
    async getAllUsers() {
        const sql = 'SELECT * FROM users ORDER BY name';
        return await database.all(sql);
    }

    /**
     * Delete user by phone number
     */
    async deleteUser(phoneNumber) {
        const sql = 'DELETE FROM users WHERE phone_number = ?';
        return await database.run(sql, [phoneNumber]);
    }

    /**
     * Check if user exists
     */
    async userExists(phoneNumber) {
        const user = await this.getUserByPhone(phoneNumber);
        return !!user;
    }

    /**
     * Update user name
     */
    async updateUserName(phoneNumber, name) {
        const sql = `
            UPDATE users 
            SET name = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE phone_number = ?
        `;
        return await database.run(sql, [name, phoneNumber]);
    }

    /**
     * Get users by group ID
     */
    async getUsersByGroup(groupId) {
        const sql = `
            SELECT u.* FROM users u
            INNER JOIN group_members gm ON u.phone_number = gm.phone_number
            WHERE gm.group_id = ?
            ORDER BY u.name
        `;
        return await database.all(sql, [groupId]);
    }
}

module.exports = new UserRepository();