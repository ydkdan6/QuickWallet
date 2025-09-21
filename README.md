# Telegram Airtime Bot

A comprehensive Telegram bot for purchasing airtime and data with wallet management, built with Node.js and deployed on Railway.

## Features

### 🚀 Core Features
- **User Registration**: Complete onboarding with personal details
- **Secure PIN System**: 4-6 digit transaction PIN with bcrypt hashing
- **Wallet Management**: Fund wallet via Paystack integration
- **Airtime Purchase**: Buy airtime for any Nigerian network
- **Data Purchase**: Purchase data bundles with various plans
- **Transaction History**: View recent transaction records
- **Natural Language Processing**: Powered by Google Gemini AI

### 🛡️ Security Features
- PIN messages are deleted immediately after entry
- All PINs are hashed using bcrypt (never stored in plain text)
- Row Level Security (RLS) enabled on all database tables
- Secure API key management

### 📱 Supported Networks
- MTN
- Airtel
- Glo
- 9mobile

## Tech Stack

- **Backend**: Node.js with Express
- **Bot Framework**: node-telegram-bot-api
- **Database**: Supabase (PostgreSQL)
- **Payment**: Paystack
- **Telecom API**: VTpass
- **AI/NLP**: Google Gemini AI
- **Deployment**: Railway
- **Security**: bcrypt for password hashing

## Database Schema

### Users Table
```sql
- id (uuid, primary key)
- telegram_id (bigint, unique)
- first_name (text)
- last_name (text)
- email (text, unique)
- phone_number (text)
- pin_hash (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Wallets Table
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- balance (decimal)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Transactions Table
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- type (text: airtime|data|funding)
- amount (decimal)
- network (text)
- phone_number (text)
- status (text: pending|completed|failed)
- reference (text)
- description (text)
- created_at (timestamptz)
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here

# Paystack Configuration
PAYSTACK_SECRET_KEY=your_paystack_secret_key_here

# VTpass Configuration
VTPASS_API_KEY=your_vtpass_api_key_here
VTPASS_SECRET_KEY=your_vtpass_secret_key_here
VTPASS_BASE_URL=https://vtpass.com/api

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Environment
NODE_ENV=production
```

## Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd telegram-airtime-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Set up Supabase database**
   - Create a new Supabase project
   - Run the migration file in the Supabase SQL editor
   - Update your `.env` with Supabase credentials

5. **Run the bot**
   ```bash
   npm start
   ```

## Deployment on Railway

### Step 1: Prepare Your Code
1. Push your code to GitHub
2. Ensure all files are committed and pushed

### Step 2: Deploy to Railway
1. Go to [Railway](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository

### Step 3: Configure Environment Variables
In Railway dashboard, go to your project settings and add these environment variables:

```
TELEGRAM_BOT_TOKEN=8415626915:AAHDWcayxRbE4kNEa593wh8WNyic0MdDckc
SUPABASE_URL=https://jooyzljesaqvohfgnmjd.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvb3l6bGplc2Fxdm9oZmdubWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTgwMDAsImV4cCI6MjA3NDAzNDAwMH0.S7Ww542iKjElD-5tt9lWSIyz00bXZlOQfXqLRhyFd6c
PAYSTACK_SECRET_KEY=sk_test_b2•••••1f1
VTPASS_API_KEY=e94c1b3792ea489622811fb93e823c1f
VTPASS_SECRET_KEY=SK_995384f64520012d58e7c4ade492f39020470eaa836
VTPASS_BASE_URL=https://vtpass.com/api
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=production
```

### Step 4: Configure Procfile
The `Procfile` is already included with:
```
worker: node index.js
```

This ensures Railway runs the bot as a worker process (24/7).

### Step 5: Deploy
1. Railway will automatically deploy your app
2. Monitor the logs to ensure everything is working
3. Test your bot by sending `/start` in Telegram

## Usage Examples

### Registration
```
User: /start
Bot: Welcome! Let's get you registered. First, what's your first name?
User: John
Bot: Great! Now, what's your last name?
User: Doe
Bot: Perfect! What's your email address?
User: john@example.com
Bot: Excellent! What's your phone number?
User: 08123456789
Bot: Account created! Please set a 4-6 digit PIN:
User: 1234
Bot: Registration completed successfully!
```

### Natural Language Commands
```
User: "Check my balance"
Bot: 💰 Your wallet balance: ₦2,500.00

User: "Buy ₦500 MTN airtime for 08123456789"
Bot: 📱 Confirm Airtime Purchase:
     Network: MTN
     Amount: ₦500
     Phone: 08123456789
     Type "yes" to confirm

User: "Get me 2GB Airtel data"
Bot: 📊 Confirm Data Purchase:
     Network: Airtel
     Plan: 2GB - 30 days
     Amount: ₦700
     Type "yes" to confirm

User: "Fund my wallet with ₦2000"
Bot: 💳 Payment Link Generated!
     Click the link to complete payment: [payment_url]
```

## API Integrations

### Paystack Integration
- Generates secure payment links
- Handles webhook notifications
- Automatic wallet crediting

### VTpass Integration
- Processes airtime purchases
- Handles data bundle purchases
- Provides real-time transaction status

### Gemini AI Integration
- Natural language understanding
- Intent classification
- Parameter extraction

## Security Best Practices

1. **PIN Security**
   - PINs are hashed using bcrypt with salt rounds of 12
   - PIN messages are deleted immediately after entry
   - Never log or store raw PINs

2. **Database Security**
   - Row Level Security (RLS) enabled
   - Proper foreign key constraints
   - Indexed for performance

3. **API Security**
   - Environment variables for sensitive data
   - Proper error handling
   - Input validation

## Monitoring and Logs

Monitor your bot through Railway's dashboard:
- View real-time logs
- Monitor resource usage
- Set up alerts for errors

## Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check if Railway service is running
   - Verify environment variables
   - Check bot token validity

2. **Database connection issues**
   - Verify Supabase credentials
   - Check network connectivity
   - Review database logs

3. **Payment issues**
   - Verify Paystack credentials
   - Check webhook configuration
   - Monitor payment logs

### Support

For issues and support:
1. Check the logs in Railway dashboard
2. Verify all environment variables are set
3. Test individual components (database, APIs)
4. Review error messages in bot logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Telegram Bot API
- Supabase for database hosting
- Railway for deployment platform
- Paystack for payment processing
- VTpass for telecom services
- Google Gemini for AI capabilities