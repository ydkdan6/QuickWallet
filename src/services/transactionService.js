const supabase = require('../config/database');

class TransactionService {
  async createTransaction(userId, transactionData) {
    try {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .insert([{
          user_id: userId,
          type: transactionData.type,
          amount: transactionData.amount,
          network: transactionData.network,
          phone_number: transactionData.phoneNumber,
          status: transactionData.status || 'pending',
          reference: transactionData.reference,
          description: transactionData.description
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, transaction };
    } catch (error) {
      console.error('Error creating transaction:', error);
      return { success: false, message: error.message };
    }
  }

  async updateTransactionStatus(transactionId, status) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status })
        .eq('id', transactionId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating transaction status:', error);
      return { success: false, message: error.message };
    }
  }

  async getUserTransactions(userId, limit = 5) {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, transactions };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new TransactionService();