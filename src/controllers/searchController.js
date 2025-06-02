const searchService = require('../services/searchService');

class SearchController {
  /**
   * POST /api/search
   * Main search endpoint with optional user personalization
   */
  async search(req, res, next) {
    try {
      const { query, limit, includeIngredients } = req.validatedData;
      
      // Extract user ID if authenticated (optional)
      const userId = req.user?.id || null;
      
      const startTime = Date.now();
      const results = await searchService.search(query, { 
        limit, 
        includeIngredients, 
        userId 
      });
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: results,
        meta: {
          processingTime: `${processingTime}ms`,
          timestamp: new Date().toISOString(),
          personalized: results.personalization?.isPersonalized || false
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/products/:productId
   * Get detailed product information
   */
  async getProductDetails(req, res, next) {
    try {
      const { productId } = req.validatedData;
      
      const product = await searchService.getProductDetails(productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
          message: 'The requested product could not be found.'
        });
      }

      res.json({
        success: true,
        data: product,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/compare
   * Compare multiple products
   */
  async compareProducts(req, res, next) {
    try {
      const { productIds } = req.validatedData;
      
      const comparison = await searchService.compareProducts(productIds);

      res.json({
        success: true,
        data: comparison,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  async healthCheck(req, res) {
    res.json({
      success: true,
      message: 'XpertBuyer API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }
}

module.exports = new SearchController(); 