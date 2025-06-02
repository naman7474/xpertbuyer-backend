const supabase = require('../config/database');

// Helper function to get client IP and device info
const getClientInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  let deviceType = 'desktop';
  
  if (userAgent.toLowerCase().includes('mobile')) {
    deviceType = 'mobile';
  } else if (userAgent.toLowerCase().includes('tablet')) {
    deviceType = 'tablet';
  }

  return {
    ip_address: req.ip || req.connection.remoteAddress,
    device_type: deviceType,
    browser: extractBrowserInfo(userAgent),
    user_agent: userAgent
  };
};

// Helper function to extract browser info from user agent
const extractBrowserInfo = (userAgent) => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('edge')) return 'Edge';
  if (ua.includes('opera')) return 'Opera';
  return 'Unknown';
};

// Track user activity
const trackActivity = async (req, res) => {
  try {
    const { user } = req; // Can be null for anonymous users
    const {
      activity_type,
      product_id,
      search_query,
      filters_applied,
      page_url,
      referrer_url,
      session_id,
      metadata
    } = req.body;

    const clientInfo = getClientInfo(req);

    const activityData = {
      user_id: user?.id || null,
      activity_type,
      product_id: product_id || null,
      search_query: search_query || null,
      filters_applied: filters_applied || null,
      page_url: page_url || null,
      referrer_url: referrer_url || null,
      session_id: session_id || null,
      device_type: clientInfo.device_type,
      browser: clientInfo.browser,
      ip_address: clientInfo.ip_address,
      metadata: metadata || null
    };

    const { data: activity, error } = await supabase
      .from('user_activity_tracking')
      .insert([activityData])
      .select('*')
      .single();

    if (error) {
      console.error('Activity tracking error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to track activity'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Activity tracked successfully',
      data: activity
    });

  } catch (error) {
    console.error('Track activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while tracking activity'
    });
  }
};

// Track product view
const trackProductView = async (req, res) => {
  try {
    const { user } = req;
    const { product_id, page_url, referrer_url, session_id } = req.body;

    const clientInfo = getClientInfo(req);

    const activityData = {
      user_id: user?.id || null,
      activity_type: 'product_view',
      product_id,
      page_url,
      referrer_url,
      session_id,
      device_type: clientInfo.device_type,
      browser: clientInfo.browser,
      ip_address: clientInfo.ip_address,
      metadata: {
        timestamp: new Date().toISOString(),
        view_duration: null // Can be updated later
      }
    };

    const { data: activity, error } = await supabase
      .from('user_activity_tracking')
      .insert([activityData])
      .select('*')
      .single();

    if (error) {
      console.error('Product view tracking error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to track product view'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Product view tracked successfully',
      data: activity
    });

  } catch (error) {
    console.error('Track product view error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while tracking product view'
    });
  }
};

// Track search query
const trackSearch = async (req, res) => {
  try {
    const { user } = req;
    const { search_query, filters_applied, results_count, session_id } = req.body;

    const clientInfo = getClientInfo(req);

    const activityData = {
      user_id: user?.id || null,
      activity_type: 'search_query',
      search_query,
      filters_applied,
      session_id,
      device_type: clientInfo.device_type,
      browser: clientInfo.browser,
      ip_address: clientInfo.ip_address,
      metadata: {
        results_count,
        timestamp: new Date().toISOString()
      }
    };

    const { data: activity, error } = await supabase
      .from('user_activity_tracking')
      .insert([activityData])
      .select('*')
      .single();

    if (error) {
      console.error('Search tracking error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to track search'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Search tracked successfully',
      data: activity
    });

  } catch (error) {
    console.error('Track search error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while tracking search'
    });
  }
};

// Track filter application
const trackFilterApplication = async (req, res) => {
  try {
    const { user } = req;
    const { filters_applied, search_context, results_count, session_id } = req.body;

    const clientInfo = getClientInfo(req);

    const activityData = {
      user_id: user?.id || null,
      activity_type: 'filter_applied',
      filters_applied,
      session_id,
      device_type: clientInfo.device_type,
      browser: clientInfo.browser,
      ip_address: clientInfo.ip_address,
      metadata: {
        search_context,
        results_count,
        timestamp: new Date().toISOString()
      }
    };

    const { data: activity, error } = await supabase
      .from('user_activity_tracking')
      .insert([activityData])
      .select('*')
      .single();

    if (error) {
      console.error('Filter tracking error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to track filter application'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Filter application tracked successfully',
      data: activity
    });

  } catch (error) {
    console.error('Track filter application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while tracking filter application'
    });
  }
};

// Track recommendation interaction
const trackRecommendation = async (req, res) => {
  try {
    const { user } = req;
    const { 
      activity_type, // 'recommendation_viewed' or 'recommendation_clicked'
      product_id, 
      recommendation_context, 
      position, 
      session_id 
    } = req.body;

    const clientInfo = getClientInfo(req);

    const activityData = {
      user_id: user?.id || null,
      activity_type,
      product_id,
      session_id,
      device_type: clientInfo.device_type,
      browser: clientInfo.browser,
      ip_address: clientInfo.ip_address,
      metadata: {
        recommendation_context,
        position,
        timestamp: new Date().toISOString()
      }
    };

    const { data: activity, error } = await supabase
      .from('user_activity_tracking')
      .insert([activityData])
      .select('*')
      .single();

    if (error) {
      console.error('Recommendation tracking error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to track recommendation interaction'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Recommendation interaction tracked successfully',
      data: activity
    });

  } catch (error) {
    console.error('Track recommendation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while tracking recommendation'
    });
  }
};

// Track wishlist action
const trackWishlist = async (req, res) => {
  try {
    const { user } = req;
    const { 
      activity_type, // 'wishlist_add' or 'wishlist_remove'
      product_id,
      session_id 
    } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required for wishlist tracking'
      });
    }

    const clientInfo = getClientInfo(req);

    const activityData = {
      user_id: user.id,
      activity_type,
      product_id,
      session_id,
      device_type: clientInfo.device_type,
      browser: clientInfo.browser,
      ip_address: clientInfo.ip_address,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    const { data: activity, error } = await supabase
      .from('user_activity_tracking')
      .insert([activityData])
      .select('*')
      .single();

    if (error) {
      console.error('Wishlist tracking error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to track wishlist action'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Wishlist action tracked successfully',
      data: activity
    });

  } catch (error) {
    console.error('Track wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while tracking wishlist action'
    });
  }
};

// Get user activity history
const getUserActivityHistory = async (req, res) => {
  try {
    const { user } = req;
    const { 
      activity_type, 
      limit = 50, 
      offset = 0,
      start_date,
      end_date 
    } = req.query;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    let query = supabase
      .from('user_activity_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (activity_type) {
      query = query.eq('activity_type', activity_type);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: activities, error } = await query;

    if (error) {
      console.error('Activity history fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch activity history'
      });
    }

    res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: activities.length
      }
    });

  } catch (error) {
    console.error('Get user activity history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching activity history'
    });
  }
};

// Get user activity analytics
const getUserActivityAnalytics = async (req, res) => {
  try {
    const { user } = req;
    const { days = 30 } = req.query;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get activity counts by type
    const { data: activityCounts, error: countsError } = await supabase
      .from('user_activity_tracking')
      .select('activity_type')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString());

    if (countsError) {
      console.error('Activity analytics error:', countsError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch activity analytics'
      });
    }

    // Process activity counts
    const activityBreakdown = activityCounts.reduce((acc, activity) => {
      acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
      return acc;
    }, {});

    // Get most viewed products
    const { data: productViews, error: viewsError } = await supabase
      .from('user_activity_tracking')
      .select('product_id')
      .eq('user_id', user.id)
      .eq('activity_type', 'product_view')
      .gte('created_at', startDate.toISOString())
      .not('product_id', 'is', null);

    if (viewsError) {
      console.error('Product views analytics error:', viewsError);
    }

    const productViewCounts = productViews?.reduce((acc, view) => {
      acc[view.product_id] = (acc[view.product_id] || 0) + 1;
      return acc;
    }, {}) || {};

    const mostViewedProducts = Object.entries(productViewCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([product_id, count]) => ({ product_id, view_count: count }));

    res.status(200).json({
      success: true,
      data: {
        activity_breakdown: activityBreakdown,
        most_viewed_products: mostViewedProducts,
        total_activities: activityCounts.length,
        period_days: parseInt(days)
      }
    });

  } catch (error) {
    console.error('Get user activity analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching activity analytics'
    });
  }
};

module.exports = {
  trackActivity,
  trackProductView,
  trackSearch,
  trackFilterApplication,
  trackRecommendation,
  trackWishlist,
  getUserActivityHistory,
  getUserActivityAnalytics
}; 