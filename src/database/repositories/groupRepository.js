const database = require('../database');
const { v4: uuidv4 } = require('crypto');

class GroupRepository {
    /**
     * Create or update a group
     */
    async createOrUpdateGroup(groupId, groupName, botActive = true) {
        const sql = `
            INSERT OR REPLACE INTO groups (group_id, group_name, bot_active, created_at)
            VALUES (?, ?, ?, COALESCE((SELECT created_at FROM groups WHERE group_id = ?), CURRENT_TIMESTAMP))
        `;
        return await database.run(sql, [groupId, groupName, botActive, groupId]);
    }

    /**
     * Get group by ID
     */
    async getGroupById(groupId) {
        const sql = 'SELECT * FROM groups WHERE group_id = ?';
        return await database.get(sql, [groupId]);
    }

    /**
     * Get all active groups
     */
    async getActiveGroups() {
        const sql = 'SELECT * FROM groups WHERE bot_active = true ORDER BY group_name';
        return await database.all(sql);
    }

    /**
     * Get all groups
     */
    async getAllGroups() {
        const sql = 'SELECT * FROM groups ORDER BY group_name';
        return await database.all(sql);
    }

    /**
     * Update group bot status
     */
    async updateBotStatus(groupId, botActive) {
        const sql = 'UPDATE groups SET bot_active = ? WHERE group_id = ?';
        return await database.run(sql, [botActive, groupId]);
    }

    /**
     * Delete group
     */
    async deleteGroup(groupId) {
        const sql = 'DELETE FROM groups WHERE group_id = ?';
        return await database.run(sql, [groupId]);
    }

    /**
     * Check if group exists
     */
    async groupExists(groupId) {
        const group = await this.getGroupById(groupId);
        return !!group;
    }

    /**
     * Add member to group
     */
    async addMemberToGroup(phoneNumber, groupId, isAdmin = false) {
        const memberId = uuidv4();
        const sql = `
            INSERT OR REPLACE INTO group_members (id, phone_number, group_id, is_admin, joined_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return await database.run(sql, [memberId, phoneNumber, groupId, isAdmin]);
    }

    /**
     * Remove member from group
     */
    async removeMemberFromGroup(phoneNumber, groupId) {
        const sql = 'DELETE FROM group_members WHERE phone_number = ? AND group_id = ?';
        return await database.run(sql, [phoneNumber, groupId]);
    }

    /**
     * Get group members
     */
    async getGroupMembers(groupId) {
        const sql = `
            SELECT gm.*, u.name 
            FROM group_members gm
            LEFT JOIN users u ON gm.phone_number = u.phone_number
            WHERE gm.group_id = ?
            ORDER BY u.name
        `;
        return await database.all(sql, [groupId]);
    }

    /**
     * Check if user is member of group
     */
    async isMemberOfGroup(phoneNumber, groupId) {
        const sql = 'SELECT 1 FROM group_members WHERE phone_number = ? AND group_id = ?';
        const result = await database.get(sql, [phoneNumber, groupId]);
        return !!result;
    }

    /**
     * Check if user is admin of group
     */
    async isAdminOfGroup(phoneNumber, groupId) {
        const sql = 'SELECT is_admin FROM group_members WHERE phone_number = ? AND group_id = ?';
        const result = await database.get(sql, [phoneNumber, groupId]);
        return result && result.is_admin;
    }
}

module.exports = new GroupRepository();