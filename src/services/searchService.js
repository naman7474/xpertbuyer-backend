const geminiService = require('./geminiService');
const productService = require('./productService');

class SearchService {
  /**
   * Main search function that implements the 4-step process
   */
  async search(query, options = {}) {
    try {
      const { limit = 4, includeIngredients = true } = options;

      // Step 1: Extract Structured Parameters
      console.log('Step 1: Parsing query...');
      const parsedQuery = await geminiService.parseQuery(query);
      console.log('Parsed query:', parsedQuery);

      // Step 2: Retrieve Relevant Products
      console.log('Step 2: Searching products...');
      const products = await productService.searchProducts(parsedQuery, limit * 3); // Get more for ranking
      console.log(`Found ${products.length} products`);

      if (products.length === 0) {
        return {
          query: query,
          parsedQuery: parsedQuery,
          products: [],
          ingredients: [],
          message: 'No products found matching your criteria. Try adjusting your search terms.'
        };
      }

      // Step 3: Rank Products
      console.log('Step 3: Ranking products...');
      const rankedProducts = await geminiService.rankProducts(products, parsedQuery, limit);
      console.log(`Ranked ${rankedProducts.length} products`);

      // Format products for response
      const formattedProducts = rankedProducts.map(product => 
        productService.formatProduct(product)
      );

      // Get relevant ingredients if requested
      let ingredientHighlights = [];
      if (includeIngredients) {
        console.log('Getting relevant ingredients...');
        const relevantIngredients = await productService.getRelevantIngredients(parsedQuery);
        
        if (relevantIngredients.length > 0) {
          ingredientHighlights = await geminiService.generateIngredientHighlights(
            parsedQuery, 
            relevantIngredients
          );
        }
      }

      // Step 4: Return Results
      return {
        query: query,
        parsedQuery: parsedQuery,
        products: formattedProducts,
        ingredients: ingredientHighlights,
        totalFound: products.length,
        message: `Found ${formattedProducts.length} recommended products for your ${parsedQuery.concern || 'skincare'} needs.`
      };

    } catch (error) {
      console.error('Error in search service:', error);
      throw new Error('Search service temporarily unavailable. Please try again.');
    }
  }

  /**
   * Get detailed product information
   */
  async getProductDetails(productId) {
    try {
      const product = await productService.getProductById(productId);
      
      if (!product) {
        return null;
      }

      // Format the detailed product response
      const formattedProduct = productService.formatProduct(product);
      
      // Add video reviews if available
      if (product.product_video_mentions && product.product_video_mentions.length > 0) {
        formattedProduct.videoReviews = product.product_video_mentions
          .filter(mention => mention.yt_videos)
          .map(mention => ({
            videoId: mention.video_id,
            title: mention.yt_videos.title,
            channel: mention.yt_videos.channel_title,
            url: mention.yt_videos.video_url,
            thumbnail: mention.yt_videos.default_thumbnail,
            viewCount: mention.yt_videos.view_count,
            likeCount: mention.yt_videos.like_count,
            sentiment: mention.sentiment,
            claimType: mention.claim_type,
            claimText: mention.claim_text,
            confidence: mention.confidence
          }));
      }

      return formattedProduct;
    } catch (error) {
      console.error('Error getting product details:', error);
      throw new Error('Unable to fetch product details. Please try again.');
    }
  }

  /**
   * Compare multiple products
   */
  async compareProducts(productIds) {
    try {
      if (!productIds || productIds.length < 2) {
        throw new Error('At least 2 product IDs are required for comparison');
      }

      const products = await productService.getProductsForComparison(productIds);
      
      if (products.length === 0) {
        return {
          products: [],
          message: 'No products found for comparison'
        };
      }

      const formattedProducts = products.map(product => 
        productService.formatProduct(product)
      );

      // Generate comparison insights
      const comparisonData = this.generateComparisonInsights(formattedProducts);

      return {
        products: formattedProducts,
        comparison: comparisonData,
        message: `Comparing ${formattedProducts.length} products`
      };
    } catch (error) {
      console.error('Error comparing products:', error);
      throw new Error('Unable to compare products. Please try again.');
    }
  }

  /**
   * Generate insights for product comparison
   */
  generateComparisonInsights(products) {
    const insights = {
      priceRange: {
        lowest: Math.min(...products.map(p => p.price.sale || p.price.mrp)),
        highest: Math.max(...products.map(p => p.price.sale || p.price.mrp))
      },
      ratingRange: {
        lowest: Math.min(...products.map(p => p.rating.average)),
        highest: Math.max(...products.map(p => p.rating.average))
      },
      commonIngredients: this.findCommonIngredients(products),
      uniqueIngredients: this.findUniqueIngredients(products),
      brands: [...new Set(products.map(p => p.brand))]
    };

    return insights;
  }

  findCommonIngredients(products) {
    if (products.length === 0) return [];
    
    const allIngredients = products.map(p => 
      p.ingredients.map(ing => ing.name?.toLowerCase()).filter(Boolean)
    );
    
    return allIngredients[0].filter(ingredient =>
      allIngredients.every(productIngredients => 
        productIngredients.includes(ingredient)
      )
    );
  }

  findUniqueIngredients(products) {
    const uniqueByProduct = products.map(product => {
      const otherProducts = products.filter(p => p.id !== product.id);
      const otherIngredients = otherProducts.flatMap(p => 
        p.ingredients.map(ing => ing.name?.toLowerCase()).filter(Boolean)
      );
      
      return {
        productId: product.id,
        uniqueIngredients: product.ingredients
          .map(ing => ing.name)
          .filter(name => name && !otherIngredients.includes(name.toLowerCase()))
      };
    });

    return uniqueByProduct;
  }
}

module.exports = new SearchService(); 