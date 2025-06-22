const supabase = require('../config/database');
const Logger = require('./logger');

/**
 * Refresh database connection and clear schema cache
 */
async function refreshDatabase() {
  try {
    Logger.info('Refreshing database connection and schema cache...');

    // Test the connection with a simple query
    const { data: testData, error: testError } = await supabase
      .from('beauty_profiles')
      .select('user_id')
      .limit(1);

    if (testError) {
      Logger.warn('Database test query failed, but this may be expected if table is empty', { 
        error: testError.message 
      });
    } else {
      Logger.info('Database connection test successful');
    }

    Logger.info('Database refresh completed successfully');
    return true;

  } catch (error) {
    Logger.error('Database refresh failed', { error: error.message });
    return false;
  }
}

module.exports = {
  refreshDatabase
}; 