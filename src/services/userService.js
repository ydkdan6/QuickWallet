const supabase = require('../config/database');
const bcrypt = require('bcrypt');

class UserService {
  async createUser(telegramId, userData) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (existingUser) {
        return { success: false, message: 'User already exists', user: existingUser };
      }

      // Create new user
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert([{
          telegram_id: telegramId,
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: userData.email,
          phone_number: userData.phoneNumber
        }])
        .select()
        .single();

      if (userError) throw userError;

      // Create wallet for user
      const { error: walletError } = await supabase
        .from('wallets')
        .insert([{
          user_id: user.id,
          balance: 0.00
        }]);

      if (walletError) throw walletError;

      return { success: true, user };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, message: error.message };
    }
  }

  async getUserByTelegramId(telegramId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return user;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  async checkEmailExists(email) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email.toLowerCase().trim())
        .single();

      // If error code is PGRST116, it means no rows found (email doesn't exist)
      if (error && error.code === 'PGRST116') {
        return false; // Email doesn't exist
      }

      if (error) throw error;

      // If we get here, email exists
      return true;
    } catch (error) {
      console.error('Error checking email existence:', error);
      // In case of error, return false to allow registration attempt
      // The actual creation will catch duplicate email constraint violation
      return false;
    }
  }

  async checkPhoneExists(phoneNumber) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, phone_number')
        .eq('phone_number', phoneNumber.trim())
        .single();

      // If error code is PGRST116, it means no rows found (phone doesn't exist)
      if (error && error.code === 'PGRST116') {
        return false; // Phone number doesn't exist
      }

      if (error) throw error;

      // If we get here, phone number exists
      return true;
    } catch (error) {
      console.error('Error checking phone number existence:', error);
      // In case of error, return false to allow registration attempt
      // The actual creation will catch duplicate phone constraint violation
      return false;
    }
  }

  async setPIN(userId, pin) {
    try {
      const saltRounds = 12;
      const pinHash = await bcrypt.hash(pin, saltRounds);

      const { error } = await supabase
        .from('users')
        .update({ pin_hash: pinHash })
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error setting PIN:', error);
      return { success: false, message: error.message };
    }
  }

  async verifyPIN(userId, pin) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('pin_hash')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!user.pin_hash) return { success: false, message: 'PIN not set' };

      const isValid = await bcrypt.compare(pin, user.pin_hash);
      return { success: isValid };
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new UserService();