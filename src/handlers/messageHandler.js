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
        `🎉 Welcome back to QuickWallet, ${user.first_name}!\n\n` +
        '💰 Your digital wallet for seamless transactions\n\n' +
        '✨ What you can do:\n' +
        '• 💳 Check your wallet balance\n' +
        '• 📱 Buy airtime for any network\n' +
        '• 📊 Purchase data bundles\n' +
        '• 💵 Fund your wallet instantly\n' +
        '• 📋 View transaction history\n' +
        '• 📊 Get monthly reports\n\n' +
        '🗣️ Just tell me what you want to do in plain English!\n' +
        'Example: "Check my balance" or "Buy ₦500 MTN airtime"'
      );
      return;
    }

    // Start registration process
    this.userStates.set(userId, { step: 'firstName' });
    await this.bot.sendMessage(chatId, 
      '🎉 Welcome to QuickWallet! 🎉\n\n' +
      '💰 Your smart digital wallet for airtime, data, and more!\n\n' +
      '✨ QuickWallet makes it easy to:\n' +
      '• Buy airtime & data for all networks\n' +
      '• Manage your digital wallet\n' +
      '• Track your spending with detailed reports\n' +
      '• Secure transactions with PIN protection\n\n' +
      '📝 Let\'s get you set up in just a few steps!\n\n' +
      '👤 First, what should I call you? Please enter your first name:'
    );
  }

  async handleUserState(chatId, userId, messageText, userState) {
    const state = userState.step;
    const userData = userState.data || {};

    switch (state) {
      case 'firstName':
        userData.firstName = messageText.trim();
        this.userStates.set(userId, { step: 'lastName', data: userData });
        await this.bot.sendMessage(chatId, 
          `Nice to meet you, ${userData.firstName}! 😊\n\n` +
          '👥 Now, what\'s your last name?'
        );
        break;

      case 'lastName':
        userData.lastName = messageText.trim();
        this.userStates.set(userId, { step: 'email', data: userData });
        await this.bot.sendMessage(chatId, 
          `Perfect, ${userData.firstName} ${userData.lastName}! 👍\n\n` +
          '📧 What\'s your email address?\n' +
          '(We\'ll use this for payment notifications and monthly reports)'
        );
        break;

      case 'email':
        if (!this.isValidEmail(messageText)) {
          await this.bot.sendMessage(chatId, 
            '❌ That doesn\'t look like a valid email address.\n\n' +
            '📧 Please enter a valid email (example: john@gmail.com):'
          );
          return;
        }
        userData.email = messageText.trim();
        this.userStates.set(userId, { step: 'phoneNumber', data: userData });
        await this.bot.sendMessage(chatId, 
          '✅ Email saved successfully!\n\n' +
          '📱 What\'s your phone number?\n' +
          '(Please enter 11 digits starting with 0, e.g., 08123456789)'
        );
        break;

      case 'phoneNumber':
        if (!this.isValidPhoneNumber(messageText)) {
          await this.bot.sendMessage(chatId, 
            '❌ That doesn\'t look like a valid phone number.\n\n' +
            '📱 Please enter a valid Nigerian phone number:\n' +
            '• Must be 11 digits\n' +
            '• Must start with 0\n' +
            '• Example: 08123456789'
          );
          return;
        }
        userData.phoneNumber = messageText.trim();
        
        // Create user account
        const result = await userService.createUser(userId, userData);
        if (result.success) {
          this.userStates.set(userId, { step: 'setPIN', data: { userId: result.user.id } });
          await this.bot.sendMessage(chatId, 
            '🎉 Congratulations! Your QuickWallet account is ready!\n\n' +
            '🔐 For security, please set a transaction PIN:\n' +
            '• Use 4-6 digits only\n' +
            '• Keep it secret and memorable\n' +
            '• You\'ll need this for all transactions\n\n' +
            '🔢 Enter your PIN now:'
          );
        } else {
          this.userStates.delete(userId);
          await this.bot.sendMessage(chatId, `❌ Registration failed: ${result.message}`);
        }
        break;

      case 'setPIN':
        if (!this.isValidPIN(messageText)) {
          await this.bot.sendMessage(chatId, 
            '❌ Invalid PIN format.\n\n' +
            '🔢 Please enter exactly 4-6 digits (numbers only):'
          );
          return;
        }
        
        // Delete the PIN message immediately
        await this.bot.deleteMessage(chatId, messageText.message_id).catch(() => {});
        
        const pinResult = await userService.setPIN(userData.userId, messageText.trim());
        this.userStates.delete(userId);
        
        if (pinResult.success) {
          await this.bot.sendMessage(chatId, 
            '🎉 Welcome to QuickWallet! 🎉\n\n' +
            '✅ Your account is fully set up and ready to use!\n\n' +
            '💰 Current wallet balance: ₦0.00\n\n' +
            '🚀 Get started:\n' +
            '• Type "fund wallet" to add money\n' +
            '• Type "check balance" to see your balance\n' +
            '• Say "buy airtime" to purchase airtime\n' +
            '• Say "get data" to buy data bundles\n\n' +
            '💡 Pro tip: Just tell me what you want in plain English!\n' +
            'I understand natural language! 😊'
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
        
      case 'monthly_report':
        await this.handleMonthlyReport(chatId, userId);
        break;
        
      case 'set_pin':
      case 'change_pin':
        this.userStates.set(userId, { step: 'setPIN', data: { userId: user.id } });
        await this.bot.sendMessage(chatId, 'Please enter your new 4-6 digit PIN:');
        break;
        
      default:
        await this.bot.sendMessage(chatId, 
          '🤔 I didn\'t quite understand that. Here\'s what I can help you with:\n\n' +
          '💰 **Wallet Management:**\n' +
          '• "Check my balance"\n' +
          '• "Fund my wallet"\n' +
          '• "Add ₦2000 to wallet"\n\n' +
          '📱 **Airtime & Data:**\n' +
          '• "Buy ₦500 MTN airtime for 08123456789"\n' +
          '• "Get me 2GB Airtel data"\n' +
          '• "Purchase 1GB MTN data"\n\n' +
          '📊 **Reports & History:**\n' +
          '• "Show my transactions"\n' +
          '• "Monthly report"\n' +
          '• "Last 5 transactions"\n\n' +
          '🔐 **Security:**\n' +
          '• "Change my PIN"\n' +
          '• "Set new PIN"\n\n' +
          '💡 Just type naturally - I understand plain English!'
        );
    }
  }

  async handleBalanceCheck(chatId, userId) {
    const user = await userService.getUserByTelegramId(userId);
    const balanceResult = await walletService.getWalletBalance(user.id);
    
    if (balanceResult.success) {
      await this.bot.sendMessage(chatId, 
        `💰 **QuickWallet Balance**\n\n` +
        `💵 Current Balance: ₦${balanceResult.balance.toFixed(2)}\n\n` +
        `${balanceResult.balance < 100 ? 
          '⚠️ Low balance! Type "fund wallet" to add money.' : 
          '✅ You\'re all set for transactions!'}`
      );
    } else {
      await this.bot.sendMessage(chatId, 
        '❌ Unable to fetch your balance right now.\n' +
        'Please try again in a moment.'
      );
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

  async handleMonthlyReport(chatId, userId) {
    const user = await userService.getUserByTelegramId(userId);
    
    // Get current month transactions
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const monthlyTransactions = await transactionService.getMonthlyTransactions(user.id, firstDayOfMonth);
    
    if (!monthlyTransactions.success || monthlyTransactions.transactions.length === 0) {
      await this.bot.sendMessage(chatId, 
        '📊 **Monthly Report**\n\n' +
        `📅 ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n\n` +
        '📝 No transactions found for this month.\n\n' +
        '💡 Start using QuickWallet to see your monthly spending patterns!'
      );
      return;
    }

    const transactions = monthlyTransactions.transactions;
    const totalSpent = transactions
      .filter(tx => tx.type !== 'funding' && tx.status === 'completed')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    const totalFunded = transactions
      .filter(tx => tx.type === 'funding' && tx.status === 'completed')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    const airtimeSpent = transactions
      .filter(tx => tx.type === 'airtime' && tx.status === 'completed')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    const dataSpent = transactions
      .filter(tx => tx.type === 'data' && tx.status === 'completed')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    let report = `📊 **QuickWallet Monthly Report**\n\n`;
    report += `📅 **${monthName}**\n\n`;
    report += `💰 **Financial Summary:**\n`;
    report += `• Total Funded: ₦${totalFunded.toFixed(2)}\n`;
    report += `• Total Spent: ₦${totalSpent.toFixed(2)}\n`;
    report += `• Net Flow: ₦${(totalFunded - totalSpent).toFixed(2)}\n\n`;
    
    if (totalSpent > 0) {
      report += `📱 **Spending Breakdown:**\n`;
      if (airtimeSpent > 0) report += `• Airtime: ₦${airtimeSpent.toFixed(2)}\n`;
      if (dataSpent > 0) report += `• Data: ₦${dataSpent.toFixed(2)}\n\n`;
    }
    
    report += `📈 **Activity:**\n`;
    report += `• Total Transactions: ${transactions.length}\n`;
    report += `• Successful: ${transactions.filter(tx => tx.status === 'completed').length}\n`;
    report += `• Failed: ${transactions.filter(tx => tx.status === 'failed').length}\n\n`;
    
    const currentBalance = await walletService.getWalletBalance(user.id);
    if (currentBalance.success) {
      report += `💵 **Current Balance:** ₦${currentBalance.balance.toFixed(2)}\n\n`;
    }
    
    report += `📊 Want detailed history? Type "show transactions"`;

    await this.bot.sendMessage(chatId, report);
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
        `💳 **Payment Link Ready!**\n\n` +
        `Amount: ₦${amount}\n` +
        `Reference: ${reference}\n\n` +
        `🔗 Click the link below to pay securely:\n` +
        `${paymentResult.paymentUrl}\n\n` +
        `✅ Your QuickWallet will be credited automatically after payment.\n` +
        `💡 Payment is secured by Paystack.`
      );
    } else {
      await this.bot.sendMessage(chatId, 
        `❌ Failed to generate payment link: ${paymentResult.message}`
      );
    }
  }

  async handleHelp(chatId) {
    const helpMessage = `
🤖 *QuickWallet Help*

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
• "Monthly report"
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
✅ Monthly reports
✅ Natural language processing
✅ 24/7 availability

Need help? Just type what you want to do!
    `;

    await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  }

  // Utility methods
  isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
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