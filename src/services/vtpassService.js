const axios = require('axios');

class VTPassService {
  constructor() {
    this.baseURL = process.env.VTPASS_BASE_URL || 'https://vtpass.com/api';
    this.apiKey = process.env.VTPASS_API_KEY;
    this.secretKey = process.env.VTPASS_SECRET_KEY;
    
    if (!this.apiKey || !this.secretKey) {
      console.warn('VTPass credentials not found. Service purchases will be simulated.');
    }
  }

  async purchaseAirtime(network, amount, phoneNumber) {
    if (!this.apiKey || !this.secretKey) {
      // Simulate successful purchase for demo
      return {
        success: true,
        reference: `DEMO_${Date.now()}`,
        message: 'Airtime purchase successful (Demo mode)'
      };
    }

    try {
      const serviceId = this.getAirtimeServiceId(network);
      const requestId = `REQ_${Date.now()}`;
      
      const response = await axios.post(`${this.baseURL}/pay`, {
        request_id: requestId,
        serviceID: serviceId,
        amount: amount,
        phone: phoneNumber
      }, {
        headers: {
          'api-key': this.apiKey,
          'secret-key': this.secretKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.code === '000') {
        return {
          success: true,
          reference: response.data.requestId,
          message: 'Airtime purchase successful'
        };
      } else {
        return {
          success: false,
          message: response.data.response_description || 'Purchase failed'
        };
      }
    } catch (error) {
      console.error('VTPass airtime purchase error:', error);
      return {
        success: false,
        message: 'Service temporarily unavailable'
      };
    }
  }

  async purchaseData(network, dataSize, phoneNumber) {
    if (!this.apiKey || !this.secretKey) {
      // Simulate successful purchase for demo
      return {
        success: true,
        reference: `DEMO_${Date.now()}`,
        message: 'Data purchase successful (Demo mode)'
      };
    }

    try {
      const serviceId = this.getDataServiceId(network);
      const variationCode = this.getDataVariationCode(network, dataSize);
      const requestId = `REQ_${Date.now()}`;
      
      const response = await axios.post(`${this.baseURL}/pay`, {
        request_id: requestId,
        serviceID: serviceId,
        billersCode: phoneNumber,
        variation_code: variationCode,
        phone: phoneNumber
      }, {
        headers: {
          'api-key': this.apiKey,
          'secret-key': this.secretKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.code === '000') {
        return {
          success: true,
          reference: response.data.requestId,
          message: 'Data purchase successful'
        };
      } else {
        return {
          success: false,
          message: response.data.response_description || 'Purchase failed'
        };
      }
    } catch (error) {
      console.error('VTPass data purchase error:', error);
      return {
        success: false,
        message: 'Service temporarily unavailable'
      };
    }
  }

  getAirtimeServiceId(network) {
    const serviceIds = {
      'MTN': 'mtn',
      'AIRTEL': 'airtel',
      'GLO': 'glo',
      '9MOBILE': 'etisalat'
    };
    return serviceIds[network.toUpperCase()] || 'mtn';
  }

  getDataServiceId(network) {
    const serviceIds = {
      'MTN': 'mtn-data',
      'AIRTEL': 'airtel-data',
      'GLO': 'glo-data',
      '9MOBILE': 'etisalat-data'
    };
    return serviceIds[network.toUpperCase()] || 'mtn-data';
  }

  getDataVariationCode(network, dataSize) {
    // This is a simplified mapping. In production, you'd fetch these from VTPass API
    const variations = {
      'MTN': {
        '500MB': 'M500_3',
        '1GB': '1000',
        '2GB': 'M2000_3',
        '3GB': 'M3000_8',
        '5GB': 'M5000_8'
      },
      'AIRTEL': {
        '500MB': '500MB-30',
        '1GB': '1GB-30',
        '2GB': '2GB-30',
        '3GB': '3GB-30',
        '5GB': '5GB-30'
      }
    };
    
    return variations[network.toUpperCase()]?.[dataSize] || '1000';
  }

  async getDataPlans(network) {
    // In production, fetch from VTPass API
    const plans = {
      'MTN': [
        { name: '500MB - 30 days', code: 'M500_3', amount: 200 },
        { name: '1GB - 30 days', code: '1000', amount: 350 },
        { name: '2GB - 30 days', code: 'M2000_3', amount: 700 },
        { name: '3GB - 30 days', code: 'M3000_8', amount: 1000 },
        { name: '5GB - 30 days', code: 'M5000_8', amount: 1500 }
      ],
      'AIRTEL': [
        { name: '500MB - 30 days', code: '500MB-30', amount: 200 },
        { name: '1GB - 30 days', code: '1GB-30', amount: 350 },
        { name: '2GB - 30 days', code: '2GB-30', amount: 700 },
        { name: '3GB - 30 days', code: '3GB-30', amount: 1000 },
        { name: '5GB - 30 days', code: '5GB-30', amount: 1500 }
      ]
    };
    
    return plans[network.toUpperCase()] || plans['MTN'];
  }
}

module.exports = new VTPassService();