const { EnhancedSearchService } = require('./sqlQueryGeneratorService');
const geminiService = require('./geminiService');
const productService = require('./productService');
const supabase = require('../config/database');

class SearchService {
  constructor() {
    // Initialize enhanced search with SQL generation
    this.enhancedSearch = new EnhancedSearchService();
  }

  /**
   * Main search function - now uses SQL generation for complex queries
   */
  async search(query, options = {}) {
    try {
      const { limit = 4, includeIngredients = true } = options;

      // Step 1: Standardize user query with Gemini (always do this first)
      console.log('Step 1: Parsing and standardizing query with Gemini...');
      const parsedQueryFull = await geminiService.parseQuery(query);
      console.log('Parsed query (full):', parsedQueryFull);

      // Step 2: Detect query complexity
      const queryComplexity = this.analyzeQueryComplexity(query);
      
      let productsToRank;
      let sqlMetadata = {}; // To store metadata from SQL generation if it happens
      let searchMethod = 'standard'; // Default search method

      // Step 3: Use enhanced search for complex queries
      if (queryComplexity.isComplex) {
        console.log('Using AI-powered SQL generation for complex query');
        try {
          const enhancedResults = await this.enhancedSearch.search(query, options);
          if (enhancedResults.products && enhancedResults.products.length > 0) {
            productsToRank = enhancedResults.products;
            sqlMetadata = enhancedResults.metadata; // Store metadata from SQL step
            searchMethod = 'ai-enhanced-sql';
            console.log(`Retrieved ${productsToRank.length} products via SQL for ranking.`);
          } else {
            console.log('AI SQL generation yielded no products, falling back to standard search logic for product retrieval.');
          }
        } catch (sqlError) {
          console.error('Error during AI SQL search, falling back to standard search logic:', sqlError);
          // Fallback to standard product retrieval if SQL search fails
        }
      }

      // If not complex, or if SQL search yielded no results/failed, use standard product retrieval
      if (!productsToRank || productsToRank.length === 0) {
        console.log('Using standard product retrieval.');
        // Pass parsedQueryFull to avoid re-parsing
        productsToRank = await productService.searchProducts(parsedQueryFull, limit * 5); // Fetch more for ranking
        searchMethod = 'standard-retrieval';
        console.log(`Retrieved ${productsToRank.length} products via standard search for ranking.`);
      }

      if (!productsToRank || productsToRank.length === 0) {
        return {
          query: query,
          parsedQuery: parsedQueryFull, // Return the fully parsed query
          products: [],
          ingredients: [],
          message: 'No products found matching your criteria. Try adjusting your search terms.',
          searchMethod: searchMethod
        };
      }

      // Step 4: Rank products using Gemini (using products from either SQL or standard search)
      console.log(`Step 4: Ranking ${productsToRank.length} products with Gemini...`);
      const rankedProducts = await geminiService.rankProducts(productsToRank, parsedQueryFull, limit);
      console.log(`Ranked ${rankedProducts.length} products.`);

      // Step 5: Format results
      return await this.formatResults(query, parsedQueryFull, rankedProducts, sqlMetadata, searchMethod, includeIngredients, productsToRank.length);

    } catch (error) {
      console.error('Critical error in main search service:', error);
      // Final fallback to a very basic standard search in case of any unexpected error in the main flow
      console.log('Critical error, attempting final fallback to basic standard search.');
      try {
        return await this.standardSearch(query, options, await geminiService.parseQuery(query)); // Reparse if absolutely necessary
      } catch (fallbackError) {
        console.error('Error in final fallback search:', fallbackError);
        throw new Error('Search service temporarily unavailable. Please try again.');
      }
    }
  }

  /**
   * Analyze query complexity to decide which search method to use
   */
  analyzeQueryComplexity(query) {
    const queryLower = query.toLowerCase();
    
    const complexityFactors = {
      hasNegation: /without|no|free from|avoid|except/.test(queryLower),
      hasConcentration: /\d+\s*%/.test(query),
      hasMultipleConcerns: (query.match(/and|&|\+|with/g) || []).length > 1,
      isRoutineQuery: /routine|regimen|morning|evening|night|steps/.test(queryLower),
      hasMedicalCondition: /rosacea|eczema|psoriasis|dermatitis/.test(queryLower),
      hasTexture: /gel|cream|foam|oil|serum|lotion|balm|stick/.test(queryLower),
      hasDemographic: /teen|men|women|baby|pregnancy|pregnant/.test(queryLower),
      hasComplexPrice: /under|below|between|less than|more than/.test(queryLower),
      wordCount: query.split(/\s+/).length
    };

    // Query is complex if it has 2+ complexity factors or is very long
    const complexFactorCount = Object.values(complexityFactors).filter(Boolean).length;
    const isComplex = complexFactorCount >= 2 || complexityFactors.wordCount > 8;

    return {
      isComplex,
      factors: complexityFactors,
      score: complexFactorCount
    };
  }

  /**
   * Format enhanced search results to match existing API structure
   */
  async formatResults(originalQuery, parsedQueryFull, rankedProducts, sqlMetadata, searchMethod, includeIngredients, totalRetrievedBeforeRanking) {
    const formattedProducts = rankedProducts.map((product, index) => {
      // Format ingredients
      const formattedIngredients = this.formatIngredients(product);
      
      // Use Gemini-provided match reason, with special formatting for top pick
      let matchReason = '';
      
      if (product.match_reason) {
        // For the top-ranked product (index 0), add special prefix
        if (index === 0) {
          matchReason = `Top pick for you! ${product.match_reason}`;
        } else {
          matchReason = product.match_reason;
        }
      } else {
        // Fallback to SQL metadata reason or generic reason
        if (searchMethod === 'ai-enhanced-sql' && sqlMetadata) {
          matchReason = this.generateMatchReason(product, sqlMetadata);
        } else {
          matchReason = index === 0 ? 'Top-rated option for your needs' : 'Relevant to your search';
        }
      }
      
      // Cap the length to keep it readable
      if (matchReason.length > 200) {
        matchReason = matchReason.substring(0, 197) + '...';
      }
      
      return {
        id: product.product_id || product.id, // Handle products from SQL or standard search
        brand: product.brand_name || product.brand,
        name: product.product_name || product.name,
        price: {
          mrp: parseFloat(product.price_mrp || product.price?.mrp) || 0,
          sale: parseFloat(product.price_sale || product.price?.sale) || 0,
          currency: product.currency || product.price?.currency || 'INR'
        },
        rating: {
          average: parseFloat(product.rating_avg || product.rating?.average) || 0,
          count: parseInt(product.rating_count || product.rating?.count) || 0
        },
        images: product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [],
        description: product.description_html || product.description,
        // Use the formatted ingredients
        ingredients: formattedIngredients, 
        benefits: product.benefits_extracted || product.benefits || [],
        sourceUrl: product.source_url || product.sourceUrl,
        size: product.size_qty || product.size,
        variant: product.shade_or_variant || product.variant,
        matchReason: matchReason
      };
    });

    let ingredientHighlights = [];
    if (includeIngredients && parsedQueryFull.concern) {
      // Use parsedQueryFull.concern which is standardized
      ingredientHighlights = await this.getIngredientHighlights([parsedQueryFull.concern]); 
    }

    let message = `Found ${formattedProducts.length} recommended products for your ${parsedQueryFull.concern || 'skincare'} needs.`;
    if (searchMethod === 'ai-enhanced-sql' && sqlMetadata?.message) {
      message = sqlMetadata.message; // Use message from SQL step if available
    } else if (searchMethod === 'ai-enhanced-sql') {
        message = `Found ${formattedProducts.length} products via AI-SQL for your ${parsedQueryFull.concern || 'skincare'} needs.`
    }

    return {
      query: originalQuery,
      parsedQuery: parsedQueryFull, // This is the standardized query from Step 1
      products: formattedProducts,
      ingredients: ingredientHighlights,
      totalFound: totalRetrievedBeforeRanking, // Total found by retrieval before ranking
      message: message,
      searchMethod: searchMethod,
      sqlGenerationMetadata: (searchMethod === 'ai-enhanced-sql') ? sqlMetadata : null
    };
  }

  /**
   * Generate explanation for why product matches
   */
  generateMatchReason(product, sqlMetadata) {
    const reasons = [];

    if (sqlMetadata.concerns && sqlMetadata.concerns.length > 0) {
      reasons.push(`Addresses ${sqlMetadata.concerns.join(', ')}`);
    }

    if (sqlMetadata.excludedIngredients && sqlMetadata.excludedIngredients.length > 0) {
      reasons.push(`Free from ${sqlMetadata.excludedIngredients.join(', ')}`);
    }

    if (sqlMetadata.priceRange) {
      reasons.push('Within your budget');
    }

    if ((parseFloat(product.rating_avg || product.rating?.average) || 0) >= 4.0) {
      reasons.push('Highly rated');
    }

    return reasons.join(' • ') || 'Relevant to your search';
  }

  /**
   * Format ingredients from various possible structures
   */
  formatIngredients(product) {
    if (product.ingredients && Array.isArray(product.ingredients) && product.ingredients.length > 0 && typeof product.ingredients[0].name !== 'undefined') {
      // This looks like already formatted ingredients from standardSearch/productService.formatProduct
      return product.ingredients;
    }
    if (product.product_ingredients && Array.isArray(product.product_ingredients)) {
      return product.product_ingredients.map(pi => ({
        name: pi.ingredients?.display_name,
        inci_name: pi.ingredients?.inci_name,
        position: pi.position,
        benefits: pi.ingredients?.benefit_summary,
        concerns: pi.ingredients?.concern_tags,
        safety: pi.ingredients?.safety_rating
      }));
    }
    if (product.ingredients_extracted) {
      try {
        const extracted = typeof product.ingredients_extracted === 'string' 
          ? JSON.parse(product.ingredients_extracted) 
          : product.ingredients_extracted;
        return Array.isArray(extracted) ? extracted.map(ing => ({ name: ing.name, concentration: ing.concentration })) : [];
      } catch (e) {
        console.warn('Failed to parse ingredients_extracted:', product.ingredients_extracted, e);
        return [];
      }
    }
    return [];
  }

  /**
   * Get ingredient highlights for concerns
   */
  async getIngredientHighlights(concerns) {
    if (!concerns || concerns.length === 0 || !concerns[0]) return [];
    try {
      const { data: ingredients, error } = await supabase
        .from('ingredients')
        .select('display_name, benefit_summary, concern_tags')
        .overlaps('concern_tags', concerns) // concerns is already an array
        .eq('is_hero', true)
        .limit(6);
      if (error) throw error;
      return ingredients.map(ing => ({ ingredient: ing.display_name, highlight: ing.benefit_summary }));
    } catch (error) {
      console.error('Error getting ingredient highlights:', error);
      return [];
    }
  }

  /**
   * Standard search implementation (original)
   */
  async standardSearch(query, options, parsedQueryInput) {
    console.log('Executing standardSearch method...');
    const parsedQuery = parsedQueryInput || await geminiService.parseQuery(query); // Parse only if not provided
    const products = await productService.searchProducts(parsedQuery, options.limit * 5);
    
    if (!products || products.length === 0) {
      return {
        query: query,
        parsedQuery: parsedQuery,
        products: [],
        ingredients: [],
        message: 'No products found matching your criteria (standard fallback).',
        searchMethod: 'standard-fallback-no-results'
      };
    }

    const rankedProducts = await geminiService.rankProducts(products, parsedQuery, options.limit);
    const formattedProducts = rankedProducts.map(product => 
      productService.formatProduct(product) // productService.formatProduct is assumed to exist and be correct
    );
    
    let ingredientHighlights = [];
    if (options.includeIngredients && parsedQuery.concern) {
        ingredientHighlights = await this.getIngredientHighlights([parsedQuery.concern]);
    }

    return {
      query: query,
      parsedQuery: parsedQuery,
      products: formattedProducts,
      ingredients: ingredientHighlights,
      totalFound: products.length, // Total retrieved before ranking
      message: `Found ${formattedProducts.length} recommended products (standard fallback).`,
      searchMethod: 'standard-fallback-ranked'
    };
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

// Example test cases for the new system
const testCases = [
  {
    query: "10% niacinamide serum without fragrance under 1000",
    expected: "Should find serums with 10% niacinamide, no fragrance, under ₹1000"
  },
  {
    query: "morning skincare routine for acne prone oily skin",
    expected: "Should return cleanser, toner, serum, moisturizer, sunscreen for oily/acne skin"
  },
  {
    query: "pregnancy safe vitamin c serum",
    expected: "Should exclude certain vitamin C derivatives unsafe for pregnancy"
  },
  {
    query: "gel moisturizer for rosacea sensitive skin",
    expected: "Should find gel-textured moisturizers with soothing ingredients"
  },
  {
    query: "men's anti-aging cream with retinol and peptides",
    expected: "Should find products marketed for men with both ingredients"
  },
  {
    query: "teen acne treatment without salicylic acid",
    expected: "Should find acne products suitable for teens excluding SA"
  },
  {
    query: "eczema body lotion fragrance free under 500",
    expected: "Should find budget body lotions for eczema without fragrance"
  },
  {
    query: "foam cleanser for combination skin no SLS",
    expected: "Should find foam cleansers without sodium lauryl sulfate"
  }
];

// Environment variable for enabling/disabling enhanced search
// Add to .env: ENABLE_AI_SQL_SEARCH=true 