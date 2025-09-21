const { GoogleGenerativeAI } = require('@google/generative-ai');

class NLPService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not found. NLP features will be limited.');
      this.genAI = null;
      return;
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  async parseIntent(message) {
    // Fallback pattern matching if Gemini is not available
    if (!this.genAI) {
      return this.parseIntentFallback(message);
    }

    try {
      const prompt = `
        Analyze this message and extract the intent and parameters. Return ONLY a JSON object with this exact structure:
        {
          "intent": "balance_check|wallet_fund|airtime_purchase|data_purchase|transactions|monthly_report|set_pin|change_pin|unknown",
          "amount": number or null,
          "network": "MTN|Airtel|Glo|9mobile" or null,
          "phoneNumber": "phone number" or null,
          "type": "airtime|data" or null,
          "dataSize": "data amount like 1GB, 500MB" or null
        }

        Message: "${message}"

        Examples:
        "Buy ₦500 MTN airtime for 08123456789" -> {"intent":"airtime_purchase","amount":500,"network":"MTN","phoneNumber":"08123456789","type":"airtime","dataSize":null}
        "Get me 2GB Airtel data" -> {"intent":"data_purchase","amount":null,"network":"Airtel","phoneNumber":null,"type":"data","dataSize":"2GB"}
        "Check balance" -> {"intent":"balance_check","amount":null,"network":null,"phoneNumber":null,"type":null,"dataSize":null}
        "Fund wallet with ₦2000" -> {"intent":"wallet_fund","amount":2000,"network":null,"phoneNumber":null,"type":null,"dataSize":null}
        "Monthly report" -> {"intent":"monthly_report","amount":null,"network":null,"phoneNumber":null,"type":null,"dataSize":null}
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this.parseIntentFallback(message);
    } catch (error) {
      console.error('Error parsing intent with Gemini:', error);
      return this.parseIntentFallback(message);
    }
  }

  parseIntentFallback(message) {
    const lowerMessage = message.toLowerCase();
    
    // Balance check patterns
    if (lowerMessage.includes('balance') || lowerMessage.includes('check balance')) {
      return { intent: 'balance_check', amount: null, network: null, phoneNumber: null, type: null, dataSize: null };
    }
    
    // Wallet funding patterns
    if (lowerMessage.includes('fund') || lowerMessage.includes('add money') || lowerMessage.includes('top up')) {
      const amountMatch = message.match(/₦?(\d+)/);
      return { 
        intent: 'wallet_fund', 
        amount: amountMatch ? parseInt(amountMatch[1]) : null, 
        network: null, 
        phoneNumber: null, 
        type: null, 
        dataSize: null 
      };
    }
    
    // Transaction history patterns
    if (lowerMessage.includes('transaction') || lowerMessage.includes('history') || lowerMessage.includes('last')) {
      return { intent: 'transactions', amount: null, network: null, phoneNumber: null, type: null, dataSize: null };
    }
    
    // Monthly report patterns
    if (lowerMessage.includes('monthly') || lowerMessage.includes('report') || lowerMessage.includes('summary')) {
      return { intent: 'monthly_report', amount: null, network: null, phoneNumber: null, type: null, dataSize: null };
    }
    
    // PIN management patterns
    if (lowerMessage.includes('set pin') || lowerMessage.includes('new pin')) {
      return { intent: 'set_pin', amount: null, network: null, phoneNumber: null, type: null, dataSize: null };
    }
    
    if (lowerMessage.includes('change pin') || lowerMessage.includes('reset pin')) {
      return { intent: 'change_pin', amount: null, network: null, phoneNumber: null, type: null, dataSize: null };
    }
    
    // Airtime purchase patterns
    if (lowerMessage.includes('airtime') || lowerMessage.includes('recharge')) {
      const amountMatch = message.match(/₦?(\d+)/);
      const phoneMatch = message.match(/(\d{11})/);
      const networkMatch = message.match(/(mtn|airtel|glo|9mobile)/i);
      
      return {
        intent: 'airtime_purchase',
        amount: amountMatch ? parseInt(amountMatch[1]) : null,
        network: networkMatch ? networkMatch[1].toUpperCase() : null,
        phoneNumber: phoneMatch ? phoneMatch[1] : null,
        type: 'airtime',
        dataSize: null
      };
    }
    
    // Data purchase patterns
    if (lowerMessage.includes('data') || lowerMessage.includes('gb') || lowerMessage.includes('mb')) {
      const dataSizeMatch = message.match(/(\d+(?:\.\d+)?)\s*(gb|mb)/i);
      const phoneMatch = message.match(/(\d{11})/);
      const networkMatch = message.match(/(mtn|airtel|glo|9mobile)/i);
      
      return {
        intent: 'data_purchase',
        amount: null,
        network: networkMatch ? networkMatch[1].toUpperCase() : null,
        phoneNumber: phoneMatch ? phoneMatch[1] : null,
        type: 'data',
        dataSize: dataSizeMatch ? `${dataSizeMatch[1]}${dataSizeMatch[2].toUpperCase()}` : null
      };
    }
    
    return { intent: 'unknown', amount: null, network: null, phoneNumber: null, type: null, dataSize: null };
  }
}

module.exports = new NLPService();