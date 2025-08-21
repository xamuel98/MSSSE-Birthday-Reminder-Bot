-- WhatsApp Birthday Reminder Bot Database Schema
-- Create all required tables with indexes

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    phone_number VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
    group_id VARCHAR(100) PRIMARY KEY,
    group_name VARCHAR(200) NOT NULL,
    bot_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
    id VARCHAR(50) PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    group_id VARCHAR(100) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (phone_number) REFERENCES users(phone_number),
    FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

-- Create indexes for group_members
CREATE INDEX IF NOT EXISTS idx_group_members_phone ON group_members(phone_number);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

-- Create birthdays table
CREATE TABLE IF NOT EXISTS birthdays (
    id VARCHAR(50) PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    birth_date DATE NOT NULL,
    group_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (phone_number) REFERENCES users(phone_number),
    FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

-- Create indexes for efficient birthday queries
CREATE INDEX IF NOT EXISTS idx_birthdays_date ON birthdays(birth_date);
CREATE INDEX IF NOT EXISTS idx_birthdays_group ON birthdays(group_id);
CREATE INDEX IF NOT EXISTS idx_birthdays_phone_group ON birthdays(phone_number, group_id);

-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
    id VARCHAR(50) PRIMARY KEY,
    birthday_id VARCHAR(50) NOT NULL,
    reminder_date DATE NOT NULL,
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP NULL,
    FOREIGN KEY (birthday_id) REFERENCES birthdays(id)
);

-- Create indexes for reminders
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_sent ON reminders(sent);

-- Insert sample configuration data
INSERT OR IGNORE INTO groups (group_id, group_name, bot_active) VALUES 
('sample_group_123', 'Family Group', true);

-- Sample user data
INSERT OR IGNORE INTO users (phone_number, name) VALUES 
('1234567890', 'John Doe'),
('0987654321', 'Jane Smith');

-- Sample birthday data
INSERT OR IGNORE INTO birthdays (id, phone_number, birth_date, group_id) VALUES 
('bd_001', '1234567890', '1990-03-15', 'sample_group_123'),
('bd_002', '0987654321', '1985-07-22', 'sample_group_123');