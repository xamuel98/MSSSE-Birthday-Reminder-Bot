# 🎂 WhatsApp Birthday Reminder Bot

A WhatsApp bot that automatically sends birthday reminders to group chats at 12 AM, allows members to manage their birthdays via commands, and tags the birthday person in the reminder message.

## ✨ Features

- 🎉 **Automatic Birthday Reminders**: Sends birthday messages at 12 AM daily
- 🏷️ **User Tagging**: Tags the birthday person in the group message
- 📅 **Command-Based Management**: Easy-to-use WhatsApp commands
- 👥 **Group Support**: Works exclusively in WhatsApp groups
- 🔒 **Privacy-Focused**: No age display - only day/month required
- 📊 **Birthday Statistics**: View group birthday stats
- 🔄 **Upcoming Birthdays**: Check who has birthdays coming up
- 💾 **SQLite Database**: Lightweight local data storage
- 🌐 **Web Dashboard**: Health monitoring and manual triggers

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- WhatsApp account
- A smartphone with WhatsApp

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd birthday-reminder-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the bot**
   ```bash
   npm start
   ```

4. **Scan QR Code**
   - A QR code will appear in your terminal
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices > Link a Device
   - Scan the QR code with your phone

5. **Add bot to groups**
   - Add the WhatsApp account to your desired groups
   - The bot will automatically introduce itself

## 📱 Available Commands

### Basic Commands

| Command | Description | Example |
|---------|-------------|----------|
| `/addbirthday DD/MM` | Add your birthday (no year for privacy) | `/addbirthday 15/03` |
| `/removebirthday` | Remove your birthday | `/removebirthday` |
| `/mybirthday` | Show your birthday info | `/mybirthday` |
| `/help` | Show help message | `/help` |

### Group Commands

| Command | Description | Example |
|---------|-------------|----------|
| `/listbirthdays` | Show all group birthdays | `/listbirthdays` |
| `/upcoming [days]` | Show upcoming birthdays | `/upcoming 7` |
| `/stats` | Show birthday statistics | `/stats` |

### Command Examples

```
# Add your birthday (day and month only for privacy)
/addbirthday 25/12

# Check upcoming birthdays in next 7 days
/upcoming 7

# View all birthdays in the group
/listbirthdays

# Get help
/help
```

## 🎯 How It Works

1. **Birthday Registration**: Users add their birthdays using `/addbirthday DD/MM` (no year for privacy)
2. **Daily Check**: Bot checks for birthdays every day at 12:00 AM Lagos time
3. **Automatic Reminders**: Sends birthday messages to groups with user tagging (no age shown)
4. **Group Management**: Tracks group members and their birthdays

## 🗂️ Project Structure

```
birthday-reminder-bot/
├── src/
│   ├── database/
│   │   ├── repositories/
│   │   │   ├── userRepository.js      # User data operations
│   │   │   ├── groupRepository.js     # Group data operations
│   │   │   ├── birthdayRepository.js  # Birthday data operations
│   │   │   ├── reminderRepository.js  # Reminder data operations
│   │   │   └── index.js              # Repository exports
│   │   ├── database.js               # Database connection
│   │   └── init.sql                  # Database schema
│   ├── services/
│   │   ├── whatsappClient.js         # WhatsApp integration
│   │   ├── commandParser.js          # Command processing
│   │   └── cronScheduler.js          # Scheduled tasks
│   └── index.js                      # Main application
├── package.json                      # Dependencies
└── README.md                        # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000

# Database Configuration
DB_PATH=./data/birthday_bot.db

# Timezone (for cron jobs)
TZ=Africa/Lagos

# Debug Mode
DEBUG=false
```

### Timezone Configuration

The bot uses cron jobs for scheduling. The default timezone is set to Lagos, West Africa:

```javascript
// Current timezone setting
timezone: 'Africa/Lagos'
```

Other common timezones:
- `America/New_York`
- `Europe/London`
- `Asia/Tokyo`
- `Australia/Sydney`
- `Asia/Singapore`

## 🌐 Web Dashboard

The bot includes a web dashboard for monitoring:

- **Health Check**: `GET http://localhost:3000/health`
- **Bot Status**: `GET http://localhost:3000/status`
- **Manual Birthday Check**: `POST http://localhost:3000/trigger/birthday-check`
- **Create Reminders**: `POST http://localhost:3000/trigger/create-reminders`

### Example API Usage

```bash
# Check bot health
curl http://localhost:3000/health

# Get detailed status
curl http://localhost:3000/status

# Manually trigger birthday check (for testing)
curl -X POST http://localhost:3000/trigger/birthday-check
```

## 📊 Database Schema

The bot uses SQLite with the following tables:

- **users**: Store user information
- **groups**: Store WhatsApp group information
- **group_members**: Track group membership
- **birthdays**: Store birthday data
- **reminders**: Track birthday reminders

## 🔄 Scheduled Tasks

| Time | Task | Description |
|------|------|-------------|
| 12:00 AM | Birthday Check | Send birthday reminders |
| 11:59 PM | Reminder Creation | Create reminders for tomorrow |
| 2:00 AM | Cleanup | Remove old reminder records |

## 🛠️ Development

### Running in Development Mode

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Testing Commands

You can test the bot functionality using the web API:

```bash
# Test birthday check
curl -X POST http://localhost:3000/trigger/birthday-check

# Test reminder creation
curl -X POST http://localhost:3000/trigger/create-reminders
```

### Adding Test Data

The database includes sample data for testing. You can modify `src/database/init.sql` to add your own test data.

## 🚨 Troubleshooting

### Common Issues

1. **QR Code Not Appearing**
   - Make sure your terminal supports QR code display
   - Try running in a different terminal
   - Check if port 3000 is available

2. **Bot Not Responding to Commands**
   - Ensure the bot is added to the group
   - Check that commands start with `/`
   - Verify the bot is connected (check web dashboard)

3. **Birthday Reminders Not Sending**
   - Check the cron scheduler status
   - Verify timezone configuration
   - Check database for pending reminders

4. **Database Errors**
   - Ensure write permissions in the project directory
   - Check if SQLite is properly installed
   - Verify database file is not corrupted

### Debug Mode

Enable debug logging by setting `DEBUG=true` in your environment:

```bash
DEBUG=true npm start
```

### Logs

The bot logs important events to the console:
- Message processing
- Command execution
- Birthday reminders sent
- Errors and warnings

## 📝 Usage Tips

1. **Date Format**: Always use DD/MM/YYYY format for birthdays
2. **Group Only**: The bot only works in WhatsApp groups, not individual chats
3. **Admin Rights**: The bot doesn't need admin rights in groups
4. **Multiple Groups**: One bot instance can handle multiple groups
5. **Backup**: Regularly backup the SQLite database file

## 🔒 Privacy & Security

- All data is stored locally in SQLite database
- No data is sent to external servers
- Only processes messages that start with `/`
- Respects WhatsApp's terms of service

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Check the web dashboard for service status
4. Create an issue with detailed information

---

**Happy Birthday Reminding! 🎉**