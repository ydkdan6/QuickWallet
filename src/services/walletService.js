const supabase = require('../config/database');

class WalletService {
  async getWalletBalance(userId) {
    try {
      const { data: wallet, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return { success: true, balance: parseFloat(wallet.balance) };
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return { success: false, message: error.message };
    }
  }

  async updateBalance(userId, amount, operation = 'add') {
    try {
      const { data: wallet, error: fetchError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = parseFloat(wallet.balance);
      const newBalance = operation === 'add' 
        ? currentBalance + amount 
        : currentBalance - amount;

      if (newBalance < 0 && operation === 'subtract') {
        return { success: false, message: 'Insufficient balance' };
      }

      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      return { success: true, newBalance };
    } catch (error) {
      console.error('Error updating wallet balance:', error);
      return { success: false, message: error.message };
    }
  }

  async deductBalance(userId, amount) {
    return this.updateBalance(userId, amount, 'subtract');
  }

  async addBalance(userId, amount) {
    return this.updateBalance(userId, amount, 'add');
  }
}

module.exports = new WalletService();