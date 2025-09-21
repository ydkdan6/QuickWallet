const axios = require('axios');

class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.baseURL = 'https://api.paystack.co';
    
    if (!this.secretKey) {
      console.warn('Paystack secret key not found. Payment features will be limited.');
    }
  }

  async generatePaymentLink(email, amount, reference, metadata = {}) {
    if (!this.secretKey) {
      // Return demo payment link
      return {
        success: true,
        paymentUrl: `https://demo-payment.com/pay?amount=${amount}&ref=${reference}`,
        reference: reference
      };
    }

    try {
      const response = await axios.post(`${this.baseURL}/transaction/initialize`, {
        email: email,
        amount: amount * 100, // Convert to kobo
        reference: reference,
        metadata: metadata,
        callback_url: `https://your-bot-domain.com/payment/callback`
      }, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status) {
        return {
          success: true,
          paymentUrl: response.data.data.authorization_url,
          reference: response.data.data.reference
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to generate payment link'
        };
      }
    } catch (error) {
      console.error('Paystack payment link error:', error);
      return {
        success: false,
        message: 'Payment service temporarily unavailable'
      };
    }
  }

  async verifyPayment(reference) {
    if (!this.secretKey) {
      // Simulate successful verification for demo
      return {
        success: true,
        amount: 2000,
        status: 'success'
      };
    }

    try {
      const response = await axios.get(`${this.baseURL}/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        }
      });

      if (response.data.status && response.data.data.status === 'success') {
        return {
          success: true,
          amount: response.data.data.amount / 100, // Convert from kobo
          status: response.data.data.status
        };
      } else {
        return {
          success: false,
          message: 'Payment verification failed'
        };
      }
    } catch (error) {
      console.error('Paystack verification error:', error);
      return {
        success: false,
        message: 'Verification service temporarily unavailable'
      };
    }
  }
}

module.exports = new PaystackService();