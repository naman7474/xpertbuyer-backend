const supabase = require('../config/database');

/**
 * Helper function to parse video URL from database format
 */
function parseVideoUrl(videoUrlData) {
  try {
    if (!videoUrlData) return null;
    
    // The video_url seems to be stored as JSON string like "[[\"https://youtu.be/DYFkTSUFWTU\"]]"
    const parsed = JSON.parse(videoUrlData);
    if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0]) && parsed[0].length > 0) {
      return parsed[0][0];
    }
    return videoUrlData;
  } catch (error) {
    // If parsing fails, return the original data
    return videoUrlData;
  }
}

class VideoController {
  /**
   * GET /api/products/:productId/videos
   * Get video content for a specific product
   */
  async getProductVideos(req, res, next) {
    try {
      const { productId } = req.params;
      
      // Get video content for the product with detailed information
      const { data: videoData, error } = await supabase
        .from('product_video_mentions')
        .select(`
          product_id,
          video_id,
          segment_id,
          sentiment,
          claim_type,
          claim_text,
          confidence,
          yt_videos (
            video_id,
            title,
            channel_title,
            published_at,
            duration_sec,
            view_count,
            like_count,
            default_thumbnail,
            video_url
          ),
          yt_segments (
            segment_id,
            start_sec,
            end_sec,
            text
          )
        `)
        .eq('product_id', productId);

      if (error) {
        throw error;
      }

      if (!videoData || videoData.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No video content found',
          message: 'No videos found for the specified product.'
        });
      }

      // Process and format the data
      const videosMap = new Map();
      const creatorsSet = new Set();

      videoData.forEach((mention) => {
        const videoId = mention.video_id;
        const creator = mention.yt_videos.channel_title;
        
        if (creator) {
          creatorsSet.add(creator);
        }

        if (!videosMap.has(videoId)) {
          videosMap.set(videoId, {
            videoId: mention.yt_videos.video_id,
            title: mention.yt_videos.title,
            channelTitle: mention.yt_videos.channel_title,
            publishedAt: mention.yt_videos.published_at,
            duration: mention.yt_videos.duration_sec,
            viewCount: mention.yt_videos.view_count,
            likeCount: mention.yt_videos.like_count,
            thumbnail: mention.yt_videos.default_thumbnail,
            videoUrl: parseVideoUrl(mention.yt_videos.video_url),
            mentions: []
          });
        }

        // Add mention details to the video
        videosMap.get(videoId).mentions.push({
          segmentId: mention.segment_id,
          startTime: mention.yt_segments.start_sec,
          endTime: mention.yt_segments.end_sec,
          text: mention.yt_segments.text,
          sentiment: mention.sentiment,
          claimType: mention.claim_type,
          claimText: mention.claim_text,
          confidence: mention.confidence
        });
      });

      const videos = Array.from(videosMap.values())
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      const creators = Array.from(creatorsSet);

      res.json({
        success: true,
        data: {
          productId: productId,
          videoCount: videos.length,
          creatorCount: creators.length,
          creators: creators,
          videos: videos
        },
        meta: {
          timestamp: new Date().toISOString(),
          totalMentions: videoData.length
        }
      });

    } catch (error) {
      console.error('Error fetching product videos:', error);
      next(error);
    }
  }

  /**
   * GET /api/videos/products-summary
   * Get a summary of video content for multiple products
   */
  async getVideosSummary(req, res, next) {
    try {
      const { productIds } = req.query;
      
      if (!productIds) {
        return res.status(400).json({
          success: false,
          error: 'Missing productIds parameter',
          message: 'Please provide productIds as a comma-separated list in the query parameters.'
        });
      }

      const productIdArray = productIds.split(',').map(id => id.trim());

      const { data: summaryData, error } = await supabase
        .from('product_video_mentions')
        .select(`
          product_id,
          video_id,
          yt_videos (
            channel_title,
            video_url
          )
        `)
        .in('product_id', productIdArray);

      if (error) {
        throw error;
      }

      // Process the data to create summary for each product
      const productSummaries = {};

      productIdArray.forEach(productId => {
        productSummaries[productId] = {
          productId: productId,
          videoUrls: [],
          creatorCount: 0,
          creators: []
        };
      });

      summaryData.forEach((mention) => {
        const productId = mention.product_id;
        const creator = mention.yt_videos.channel_title;
        const videoUrl = parseVideoUrl(mention.yt_videos.video_url);

        if (productSummaries[productId]) {
          // Add video URL if not already added
          if (!productSummaries[productId].videoUrls.includes(videoUrl)) {
            productSummaries[productId].videoUrls.push(videoUrl);
          }

          // Add creator if not already added
          if (creator && !productSummaries[productId].creators.includes(creator)) {
            productSummaries[productId].creators.push(creator);
          }
        }
      });

      // Update creator counts
      Object.keys(productSummaries).forEach(productId => {
        productSummaries[productId].creatorCount = productSummaries[productId].creators.length;
      });

      res.json({
        success: true,
        data: Object.values(productSummaries),
        meta: {
          timestamp: new Date().toISOString(),
          totalProducts: productIdArray.length
        }
      });

    } catch (error) {
      console.error('Error fetching videos summary:', error);
      next(error);
    }
  }


}

module.exports = new VideoController(); 