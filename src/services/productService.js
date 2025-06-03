const supabase = require('../config/database');
const Logger = require('../utils/logger');

class ProductService {
  /**
   * Step 2: Retrieve relevant products using semantic search and filters (IMPROVED VERSION)
   */
  async searchProducts(parsedQuery, limit = 20) {
    try {
      let hasConditions = false;
      let products = [];

      // Priority 1: If ingredient is specified, find products with that ingredient first
      if (parsedQuery.ingredient) {
        products = await this.searchByIngredientDatabase(parsedQuery, limit);
        hasConditions = true;
      }
      
      // If no ingredient or no results from ingredient search, fallback to other methods
      if (!hasConditions || products.length === 0) {
        // Build standard query
        let query = supabase
          .from('products')
          .select(`
            *,
            product_ingredients(
              ingredient_id,
              position,
              ingredients(
                display_name,
                inci_name,
                benefit_summary,
                concern_tags,
                safety_rating,
                is_hero
              )
            )
          `);

        // Priority 2: Search by product type
        if (parsedQuery.product_type) {
          query = query.ilike('product_name', `%${parsedQuery.product_type}%`);
          hasConditions = true;
        }
        
        // Priority 3: Search by concern if no product type
        else if (parsedQuery.concern && !hasConditions) {
          query = query.ilike('product_name', `%${parsedQuery.concern}%`);
          hasConditions = true;
        }
        
        // Priority 4: Search by brand
        else if (parsedQuery.brand && !hasConditions) {
          query = query.ilike('brand_name', `%${parsedQuery.brand}%`);
          hasConditions = true;
        }

        // If no specific search terms, get popular products
        if (!hasConditions) {
          query = query.gte('rating_avg', 4.0);
        }

        // Price filtering
        if (parsedQuery.price_sensitivity) {
          const priceRanges = {
            'budget': { min: 0, max: 500 },
            'mid-range': { min: 500, max: 1500 },
            'premium': { min: 1500, max: 3000 },
            'luxury': { min: 3000, max: 999999 }
          };
          
          const range = priceRanges[parsedQuery.price_sensitivity];
          if (range) {
            query = query.gte('price_sale', range.min).lte('price_sale', range.max);
          }
        }

        // Execute query with limit
        const { data: fallbackProducts, error } = await query.limit(limit);

        if (error) {
          Logger.error('Error searching products', { error: error.message });
          return [];
        }

        // If we had ingredient search results, filter them by product type if needed
        if (products.length > 0 && parsedQuery.product_type) {
          products = products.filter(product => 
            product.product_name.toLowerCase().includes(parsedQuery.product_type.toLowerCase())
          );
        }

        // Use ingredient search results if available, otherwise use fallback
        products = products.length > 0 ? products : (fallbackProducts || []);
      }

      return products;
    } catch (error) {
      Logger.error('Error in searchProducts', { error: error.message });
      return [];
    }
  }

  /**
   * Database-level ingredient search using proper joins
   */
  async searchByIngredientDatabase(parsedQuery, limit = 20) {
    try {
      // Step 1: Find ingredient IDs that match the search term
      const { data: ingredients, error: ingredientError } = await supabase
        .from('ingredients')
        .select('ingredient_id, display_name, inci_name')
        .or(`display_name.ilike.%${parsedQuery.ingredient}%,inci_name.ilike.%${parsedQuery.ingredient}%`);

      if (ingredientError || !ingredients || ingredients.length === 0) {
        Logger.debug('No matching ingredients found for', { ingredient: parsedQuery.ingredient });
        return [];
      }

      const ingredientIds = ingredients.map(ing => ing.ingredient_id);

      // Step 2: Find products that contain these ingredients
      const { data: productIngredients, error: piError } = await supabase
        .from('product_ingredients')
        .select('product_id')
        .in('ingredient_id', ingredientIds);

      if (piError || !productIngredients || productIngredients.length === 0) {
        Logger.debug('No products found with ingredient', { ingredient: parsedQuery.ingredient });
        return [];
      }

      const productIds = [...new Set(productIngredients.map(pi => pi.product_id))];

      // Step 3: Get full product details for these products
      let query = supabase
        .from('products')
        .select(`
          *,
          product_ingredients(
            ingredient_id,
            position,
            ingredients(
              display_name,
              inci_name,
              benefit_summary,
              concern_tags,
              safety_rating,
              is_hero
            )
          )
        `)
        .in('product_id', productIds);

      // Add additional filters
      if (parsedQuery.product_type) {
        query = query.ilike('product_name', `%${parsedQuery.product_type}%`);
      }

      if (parsedQuery.price_sensitivity) {
        const priceRanges = {
          'budget': { min: 0, max: 500 },
          'mid-range': { min: 500, max: 1500 },
          'premium': { min: 1500, max: 3000 },
          'luxury': { min: 3000, max: 999999 }
        };
        
        const range = priceRanges[parsedQuery.price_sensitivity];
        if (range) {
          query = query.gte('price_sale', range.min).lte('price_sale', range.max);
        }
      }

      // Order by rating and limit results
      query = query.order('rating_avg', { ascending: false }).limit(limit);

      const { data: products, error: productError } = await query;

      if (productError) {
        Logger.error('Error fetching products by ingredient', { error: productError.message });
        return [];
      }

      Logger.debug(`Found ${products?.length || 0} products with ingredient: ${parsedQuery.ingredient}`);
      return products || [];
    } catch (error) {
      Logger.error('Error in searchByIngredientDatabase', { error: error.message });
      return [];
    }
  }

  /**
   * Get relevant ingredients based on parsed query
   */
  async getRelevantIngredients(parsedQuery) {
    try {
      let query = supabase
        .from('ingredients')
        .select('*');

      // If specific ingredient mentioned, prioritize it
      if (parsedQuery.ingredient) {
        query = query.or(`display_name.ilike.%${parsedQuery.ingredient}%,inci_name.ilike.%${parsedQuery.ingredient}%`);
      }
      // If concern mentioned, find ingredients that address it
      else if (parsedQuery.concern) {
        const concernMap = {
          'acne': ['acne', 'oil_control', 'pore_clearing', 'exfoliation'],
          'dryness': ['hydration', 'moisturizing', 'barrier_repair'],
          'aging': ['anti_aging', 'wrinkles', 'firmness', 'elasticity'],
          'pigmentation': ['brightening', 'dark_spots', 'hyperpigmentation'],
          'sensitivity': ['soothing', 'anti_inflammatory', 'gentle'],
          'oily': ['oil_control', 'pore_minimizing', 'mattifying'],
          'dark circles': ['brightening', 'circulation', 'anti_aging']
        };

        const concernTags = concernMap[parsedQuery.concern.toLowerCase()] || [];
        if (concernTags.length > 0) {
          query = query.overlaps('concern_tags', concernTags);
        }
      }

      // Prioritize hero ingredients
      query = query.order('is_hero', { ascending: false });
      query = query.limit(6);

      const { data: ingredients, error } = await query;

      if (error) {
        Logger.error('Error fetching ingredients', { error: error.message });
        return [];
      }

      return ingredients || [];
    } catch (error) {
      Logger.error('Error in getRelevantIngredients', { error: error.message });
      return [];
    }
  }

  /**
   * Get product details by ID
   */
  async getProductById(productId) {
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          *,
          product_ingredients(
            ingredient_id,
            position,
            ingredients(
              display_name,
              inci_name,
              benefit_summary,
              concern_tags,
              safety_rating
            )
          ),
          product_video_mentions(
            video_id,
            sentiment,
            claim_type,
            claim_text,
            confidence,
            yt_videos(
              title,
              channel_title,
              video_url,
              default_thumbnail,
              view_count,
              like_count
            )
          )
        `)
        .eq('product_id', productId)
        .single();

      if (error) {
        Logger.error('Error fetching product details', { error: error.message, productId });
        return null;
      }

      return product;
    } catch (error) {
      Logger.error('Error in getProductById', { error: error.message, productId });
      return null;
    }
  }

  /**
   * Get products for comparison
   */
  async getProductsForComparison(productIds) {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          product_ingredients(
            ingredient_id,
            position,
            ingredients(
              display_name,
              inci_name,
              benefit_summary,
              concern_tags,
              safety_rating
            )
          )
        `)
        .in('product_id', productIds);

      if (error) {
        Logger.error('Error fetching products for comparison', { error: error.message, productIds });
        return [];
      }

      return products || [];
    } catch (error) {
      Logger.error('Error in getProductsForComparison', { error: error.message, productIds });
      return [];
    }
  }

  /**
   * Helper methods
   */
  buildSearchTerms(parsedQuery) {
    const terms = [];
    
    if (parsedQuery.concern) terms.push(parsedQuery.concern);
    if (parsedQuery.ingredient) terms.push(parsedQuery.ingredient);
    if (parsedQuery.product_type) terms.push(parsedQuery.product_type);
    if (parsedQuery.skin_type) terms.push(parsedQuery.skin_type);
    
    return terms;
  }

  filterByIngredient(products, ingredientName) {
    return products.filter(product => {
      if (!product.product_ingredients) return false;
      
      return product.product_ingredients.some(pi => {
        const ingredient = pi.ingredients;
        return ingredient && (
          ingredient.display_name.toLowerCase().includes(ingredientName.toLowerCase()) ||
          ingredient.inci_name?.toLowerCase().includes(ingredientName.toLowerCase())
        );
      });
    });
  }

  /**
   * Format product for API response
   */
  formatProduct(product) {
    return {
      id: product.product_id,
      brand: product.brand_name,
      name: product.product_name,
      price: {
        mrp: parseFloat(product.price_mrp) || 0,
        sale: parseFloat(product.price_sale) || 0,
        currency: product.currency || 'INR'
      },
      rating: {
        average: parseFloat(product.rating_avg) || 0,
        count: parseInt(product.rating_count) || 0
      },
      images: product.images ? JSON.parse(product.images) : [],
      description: product.description_html,
      ingredients: product.product_ingredients?.map(pi => ({
        name: pi.ingredients?.display_name,
        inci_name: pi.ingredients?.inci_name,
        position: pi.position,
        benefits: pi.ingredients?.benefit_summary,
        concerns: pi.ingredients?.concern_tags,
        safety: pi.ingredients?.safety_rating
      })) || [],
      benefits: product.benefits_extracted || [],
      sourceUrl: product.source_url,
      size: product.size_qty,
      variant: product.shade_or_variant
    };
  }
}

module.exports = new ProductService(); 