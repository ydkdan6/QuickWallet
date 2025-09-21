const userService = require('../services/userService');
const walletService = require('../services/walletService');
const transactionService = require('../services/transactionService');
const nlpService = require('../services/nlpService');
const vtpassService = require('../services/vtpassService');
const paystackService = require('../services/paystackService');

class MessageHandler {
  constructor(bot) {
    this.bot = bot;
    this.userStates = new Map(); // Store user conversation states
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;

    try {
      // Get user from database
      const user = await userService.getUserByTelegramId(userId);
      
      if (!user && messageText !== '/start') {
        await this.bot.sendMessage(chatId, 
          '👋 Welcome! Please start by typing /start to register your account.'
        );
        return;
      }

      // Handle user states (for multi-step conversations)
      const userState = this.userStates.get(userId);
      if (userState) {
        await this.handleUserState(chatId, userId, messageText, userState);
        return;
      }

      // Handle commands
      if (messageText.startsWith('/')) {
        await this.handleCommand(chatId, userId, messageText);
        return;
      }

      // Handle natural language processing
      const intent = await nlpService.parseIntent(messageText);
      await this.handleIntent(chatId, userId, intent, messageText);

    } catch (error) {
      console.error('Error handling message:', error);
      await this.bot.sendMessage(chatId, 
        '❌ Sorry, something went wrong. Please try again later.'
      );
    }
  }

  async handleCommand(chatId, userId, command) {
    switch (command) {
      case '/start':
        await this.handleStart(chatId, userId);
        break;
      case '/balance':
        await this.handleBalanceCheck(chatId, userId);
        break;
      case '/help':
        await this.handleHelp(chatId);
        break;
      default:
        await this.bot.sendMessage(chatId, 
          '❓ Unknown command. Type /help to see available commands.'
        );
    }
  }

  async handleStart(chatId, userId) {
    const user = await userService.getUserByTelegramId(userId);
    
    if (user) {
      await this.bot.sendMessage(chatId, 
        `👋 Welcome back, ${user.first_name}!\n\n` +
        'You can:\n' +
        '• Check your balance\n' +
        '• Buy airtime or data\n' +
        '• Fund your wallet\n' +
        '• View transaction history\n\n' +
        'Just type what you want to do in natural language!'
      );
      return;
    }

    // Start registration process
    this.userStates.set(userId, { step: 'firstName' });
    await this.bot.sendMessage(chatId, 
      '👋 Welcome to AirtimeBot!\n\n' +
      'Let\'s get you registered. First, what\'s your first name?'
    );
  }

  async handleUserState(chatId, userId, messageText, userState) {
    const state = userState.step;
    const userData = userState.data || {};

    switch (state) {
      case 'firstName':
        userData.firstName = messageText.trim();
        this.userStates.set(userId, { step: 'lastName', data: userData });
        await this.bot.sendMessage(chatId, 'Great! Now, what\'s your last name?');
        break;

      case 'lastName':
        userData.lastName = messageText.trim();
        this.userStates.set(userId, { step: 'email', data: userData });
        await this.bot.sendMessage(chatId, 'Perfect! What\'s your email address?');
        break;

      case 'email':
        if (!this.isValidEmail(messageText)) {
          await this.bot.sendMessage(chatId, 'Please enter a valid email address.');
          return;
        }
        userData.email = messageText.trim();
        this.userStates.set(userId, { step: 'phoneNumber', data: userData });
        await this.bot.sendMessage(chatId, 'Excellent! What\'s your phone number? (e.g., 08123456789)');
        break;

      case 'phoneNumber':
        if (!this.isValidPhoneNumber(messageText)) {
          await this.bot.sendMessage(chatId, 'Please enter a valid Nigerian phone number (11 digits starting with 0).');
          return;
        }
        userData.phoneNumber = messageText.trim();
        
        // Create user account
        const result = await userService.createUser(userId, userData);
        if (result.success) {
          this.userStates.set(userId, { step: 'setPIN', data: { userId: result.user.id } });
          await this.bot.sendMessage(chatId, 
            '🎉 Account created successfully!\n\n' +
            'Now, please set a 4-6 digit transaction PIN for security:'
          );
        } else {
          this.userStates.delete(userId);
          await this.bot.sendMessage(chatId, `❌ Registration failed: ${result.message}`);
        }
        break;

      case 'setPIN':
        if (!this.isValidPIN(messageText)) {
          await this.bot.sendMessage(chatId, 'Please enter a 4-6 digit PIN.');
          return;
        }
        
        // Delete the PIN message immediately
        await this.bot.deleteMessage(chatId, messageText.message_id).catch(() => {});
        
        const pinResult = await userService.setPIN(userData.userId, messageText.trim());
        this.userStates.delete(userId);
        
        if (pinResult.success) {
          await this.bot.sendMessage(chatId, 
            '✅ Registration completed successfully!\n\n' +
            'Your account is ready. You can now:\n' +
            '• Check your balance\n' +
            '• Buy airtime or data\n' +
            '• Fund your wallet\n\n' +
            'Just type what you want to do!'
          );
        } else {
          await this.bot.sendMessage(chatId, `❌ Failed to set PIN: ${pinResult.message}`);
        }
        break;

      case 'confirmPurchase':
        if (messageText.toLowerCase() === 'yes') {
          await this.processPurchase(chatId, userId, userData);
        } else {
          this.userStates.delete(userId);
          await this.bot.sendMessage(chatId, '❌ Purchase cancelled.');
        }
        break;

      case 'enterPIN':
        // Delete the PIN message immediately
        await this.bot.deleteMessage(chatId, messageText.message_id).catch(() => {});
        
        const verification = await userService.verifyPIN(userData.userId, messageText.trim());
        if (verification.success) {
          await this.processPurchase(chatId, userId, userData);
        } else {
          this.userStates.delete(userId);
          await this.bot.sendMessage(chatId, '❌ Invalid PIN. Transaction cancelled.');
        }
        break;

      case 'fundAmount':
        const amount = parseFloat(messageText);
        if (isNaN(amount) || amount < 100) {
          await this.bot.sendMessage(chatId, 'Please enter a valid amount (minimum ₦100).');
          return;
        }
        await this.generatePaymentLink(chatId, userId, amount);
        break;
    }
  }

  async handleIntent(chatId, userId, intent, originalMessage) {
    const user = await userService.getUserByTelegramId(userId);
    
    switch (intent.intent) {
      case 'balance_check':
        await this.handleBalanceCheck(chatId, userId);
        break;
        
      case 'wallet_fund':
        if (intent.amount) {
          await this.generatePaymentLink(chatId, userId, intent.amount);
        } else {
          this.userStates.set(userId, { step: 'fundAmount' });
          await this.bot.sendMessage(chatId, 'How much would you like to add to your wallet? (minimum ₦100)');
        }
        break;
        
      case 'airtime_purchase':
        await this.handleAirtimePurchase(chatId, userId, intent);
        break;
        
      case 'data_purchase':
        await this.handleDataPurchase(chatId, userId, intent);
        break;
        
      case 'transactions':
        await this.handleTransactionHistory(chatId, userId);
        break;
        
      case 'set_pin':
      case 'change_pin':
        this.userStates.set(userId, { step: 'setPIN', data: { userId: user.id } });
        await this.bot.sendMessage(chatId, 'Please enter your new 4-6 digit PIN:');
        break;
        
      default:
        await this.bot.sendMessage(chatId, 
          '🤔 I didn\'t understand that. You can:\n\n' +
          '• Check balance\n' +
          '• Buy airtime: "Buy ₦500 MTN airtime for 08123456789"\n' +
          '• Buy data: "Get me 2GB Airtel data"\n' +
          '• Fund wallet: "Add ₦2000 to my wallet"\n' +
          '• View transactions: "Show my last 5 transactions"\n' +
          '• Change PIN: "Set a new PIN"'
        );
    }
  }

  async handleBalanceCheck(chatId, userId) {
    const user = await userService.getUserByTelegramId(userId);
    const balanceResult = await walletService.getWalletBalance(user.id);
    
    if (balanceResult.success) {
      await this.bot.sendMessage(chatId, 
        `💰 Your wallet balance: ₦${balanceResult.balance.toFixed(2)}`
      );
    } else {
      await this.bot.sendMessage(chatId, '❌ Unable to fetch balance. Please try again.');
    }
  }

  async handleAirtimePurchase(chatId, userId, intent) {
    const user = await userService.getUserByTelegramId(userId);
    
    // Validate required fields
    if (!intent.amount || !intent.network || !intent.phoneNumber) {
      await this.bot.sendMessage(chatId, 
        'Please provide all details: amount, network, and phone number.\n' +
        'Example: "Buy ₦500 MTN airtime for 08123456789"'
      );
      return;
    }

    // Check wallet balance
    const balanceResult = await walletService.getWalletBalance(user.id);
    if (!balanceResult.success || balanceResult.balance < intent.amount) {
      await this.bot.sendMessage(chatId, 
        '❌ Insufficient wallet balance. Please fund your wallet first.'
      );
      return;
    }

    // Confirm purchase
    this.userStates.set(userId, {
      step: 'confirmPurchase',
      data: {
        userId: user.id,
        type: 'airtime',
        amount: intent.amount,
        network: intent.network,
        phoneNumber: intent.phoneNumber
      }
    });

    await this.bot.sendMessage(chatId, 
      `📱 Confirm Airtime Purchase:\n\n` +
      `Network: ${intent.network}\n` +
      `Amount: ₦${intent.amount}\n` +
      `Phone: ${intent.phoneNumber}\n\n` +
      `Type "yes" to confirm or "no" to cancel.`
    );
  }

  async handleDataPurchase(chatId, userId, intent) {
    const user = await userService.getUserByTelegramId(userId);
    
    if (!intent.network || !intent.dataSize) {
      await this.bot.sendMessage(chatId, 
        'Please specify the network and data size.\n' +
        'Example: "Get me 2GB MTN data"'
      );
      return;
    }

    // Get data plans and pricing
    const plans = await vtpassService.getDataPlans(intent.network);
    const selectedPlan = plans.find(plan => plan.name.includes(intent.dataSize));
    
    if (!selectedPlan) {
      const availablePlans = plans.map(plan => `• ${plan.name} - ₦${plan.amount}`).join('\n');
      await this.bot.sendMessage(chatId, 
        `❌ Data plan not found. Available ${intent.network} plans:\n\n${availablePlans}`
      );
      return;
    }

    // Check wallet balance
    const balanceResult = await walletService.getWalletBalance(user.id);
    if (!balanceResult.success || balanceResult.balance < selectedPlan.amount) {
      await this.bot.sendMessage(chatId, 
        '❌ Insufficient wallet balance. Please fund your wallet first.'
      );
      return;
    }

    // Confirm purchase
    this.userStates.set(userId, {
      step: 'confirmPurchase',
      data: {
        userId: user.id,
        type: 'data',
        amount: selectedPlan.amount,
        network: intent.network,
        phoneNumber: intent.phoneNumber || user.phone_number,
        dataSize: intent.dataSize
      }
    });

    await this.bot.sendMessage(chatId, 
      `📊 Confirm Data Purchase:\n\n` +
      `Network: ${intent.network}\n` +
      `Plan: ${selectedPlan.name}\n` +
      `Amount: ₦${selectedPlan.amount}\n` +
      `Phone: ${intent.phoneNumber || user.phone_number}\n\n` +
      `Type "yes" to confirm or "no" to cancel.`
    );
  }

  async processPurchase(chatId, userId, purchaseData) {
    this.userStates.delete(userId);
    
    try {
      // Deduct from wallet
      const deductResult = await walletService.deductBalance(purchaseData.userId, purchaseData.amount);
      if (!deductResult.success) {
        await this.bot.sendMessage(chatId, `❌ ${deductResult.message}`);
        return;
      }

      // Create transaction record
      const transactionData = {
        type: purchaseData.type,
        amount: purchaseData.amount,
        network: purchaseData.network,
        phoneNumber: purchaseData.phoneNumber,
        status: 'pending',
        description: `${purchaseData.type} purchase - ${purchaseData.network}`
      };

      const transactionResult = await transactionService.createTransaction(purchaseData.userId, transactionData);
      
      // Process with VTPass
      let serviceResult;
      if (purchaseData.type === 'airtime') {
        serviceResult = await vtpassService.purchaseAirtime(
          purchaseData.network, 
          purchaseData.amount, 
          purchaseData.phoneNumber
        );
      } else {
        serviceResult = await vtpassService.purchaseData(
          purchaseData.network, 
          purchaseData.dataSize, 
          purchaseData.phoneNumber
        );
      }

      // Update transaction status
      if (transactionResult.success) {
        await transactionService.updateTransactionStatus(
          transactionResult.transaction.id, 
          serviceResult.success ? 'completed' : 'failed'
        );
      }

      if (serviceResult.success) {
        await this.bot.sendMessage(chatId, 
          `✅ ${serviceResult.message}\n\n` +
          `Reference: ${serviceResult.reference}\n` +
          `New balance: ₦${deductResult.newBalance.toFixed(2)}`
        );
      } else {
        // Refund the amount
        await walletService.addBalance(purchaseData.userId, purchaseData.amount);
        await this.bot.sendMessage(chatId, 
          `❌ Purchase failed: ${serviceResult.message}\n` +
          `Amount has been refunded to your wallet.`
        );
      }

    } catch (error) {
      console.error('Error processing purchase:', error);
      await this.bot.sendMessage(chatId, '❌ Purchase failed. Please try again.');
    }
  }

  async handleTransactionHistory(chatId, userId) {
    const user = await userService.getUserByTelegramId(userId);
    const transactionsResult = await transactionService.getUserTransactions(user.id, 5);
    
    if (!transactionsResult.success || transactionsResult.transactions.length === 0) {
      await this.bot.sendMessage(chatId, '📝 No transactions found.');
      return;
    }

    let message = '📝 Your Recent Transactions:\n\n';
    transactionsResult.transactions.forEach((tx, index) => {
      const date = new Date(tx.created_at).toLocaleDateString();
      const status = tx.status === 'completed' ? '✅' : tx.status === 'failed' ? '❌' : '⏳';
      message += `${index + 1}. ${status} ${tx.type.toUpperCase()}\n`;
      message += `   Amount: ₦${tx.amount}\n`;
      if (tx.network) message += `   Network: ${tx.network}\n`;
      if (tx.phone_number) message += `   Phone: ${tx.phone_number}\n`;
      message += `   Date: ${date}\n\n`;
    });

    await this.bot.sendMessage(chatId, message);
  }

  async generatePaymentLink(chatId, userId, amount) {
    const user = await userService.getUserByTelegramId(userId);
    const reference = `FUND_${userId}_${Date.now()}`;
    
    const paymentResult = await paystackService.generatePaymentLink(
      user.email, 
      amount, 
      reference,
      { userId: user.id, telegramId: userId }
    );

    this.userStates.delete(userId);

    if (paymentResult.success) {
      await this.bot.sendMessage(chatId, 
        `💳 Payment Link Generated!\n\n` +
        `Amount: ₦${amount}\n` +
        `Reference: ${reference}\n\n` +
        `Click the link below to complete payment:\n` +
        `${paymentResult.paymentUrl}\n\n` +
        `Your wallet will be credited automatically after successful payment.`
      );
    } else {
      await this.bot.sendMessage(chatId, 
        `❌ Failed to generate payment link: ${paymentResult.message}`
      );
    }
  }

  async handleHelp(chatId) {
    const helpMessage = `
🤖 *AirtimeBot Help*

*Available Commands:*
/start - Register or restart
/balance - Check wallet balance
/help - Show this help message

*Natural Language Examples:*
• "Check my balance"
• "Buy ₦500 MTN airtime for 08123456789"
• "Get me 2GB Airtel data"
• "Fund my wallet with ₦2000"
• "Show my last 5 transactions"
• "Set a new PIN"

*Supported Networks:*
• MTN
• Airtel
• Glo
• 9mobile

*Features:*
✅ Secure PIN protection
✅ Wallet management
✅ Transaction history
✅ Natural language processing
✅ 24/7 availability

Need help? Just type what you want to do!
    `;

    await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  }

  // Utility methods
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhoneNumber(phone) {
    const phoneRegex = /^0[789][01]\d{8}$/;
    return phoneRegex.test(phone);
  }

  isValidPIN(pin) {
    const pinRegex = /^\d{4,6}$/;
    return pinRegex.test(pin);
  }
}

module.exports = MessageHandler;