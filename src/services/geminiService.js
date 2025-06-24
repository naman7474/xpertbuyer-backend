const geminiWrapper = require('./geminiWrapper');
const { USER_SEGMENTS, INTENT_TYPES } = require('../constants/userSegments');
const Logger = require('../utils/logger');

class GeminiService {
  /**
   * Step 1: Extract structured parameters from raw search query
   */
  async parseQuery(query) {
    const prompt = `
You are an expert skincare consultant. Parse the following user query and extract structured information.

User Query: "${query}"

Extract the following information and return ONLY a valid JSON object:

{
  "intent": "one of: treatment_search, ingredient_lookup, product_comparison, brand_exploration, price_comparison, general_inquiry",
  "concern": "primary skin concern (e.g., acne, dryness, aging, pigmentation, sensitivity) or null",
  "ingredient": "specific ingredient mentioned (e.g., niacinamide, hyaluronic acid, retinol) or null",
  "product_type": "type of product (e.g., face wash, serum, moisturizer, sunscreen) or null",
  "skin_type": "skin type mentioned (e.g., oily, dry, combination, sensitive, normal) or null",
  "price_sensitivity": "one of: budget, mid-range, premium, luxury, or null",
  "brand": "specific brand mentioned or null",
  "user_segment": "one of: Concern-Focused Novices, Ingredient-Conscious, Clean/Organic Beauty Seekers, Brand-Focused, Value/Deal Hunters, Luxury/Aspirational Shoppers"
}

Guidelines:
- Analyze the language complexity and terminology to determine user_segment
- If user mentions specific ingredients or scientific terms, likely "Ingredient-Conscious"
- If user mentions budget/cheap/affordable, likely "Value/Deal Hunters"
- If user mentions luxury/premium brands, likely "Luxury/Aspirational Shoppers"
- If user mentions natural/organic/paraben-free, likely "Clean/Organic Beauty Seekers"
- If user mentions specific brands, likely "Brand-Focused"
- If user uses simple language about skin problems, likely "Concern-Focused Novices"
- Extract only what's explicitly mentioned, use null for missing information
`;

    try {
      const result = await geminiWrapper.generateContent('flash', prompt);
      const response = result.text;
      
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const parsedData = JSON.parse(jsonMatch[0]);
      
      // Validate the parsed data
      this.validateParsedQuery(parsedData);
      
      return parsedData;
    } catch (error) {
      Logger.error('Error parsing query with Gemini', { error: error.message });
      // Return a fallback structure
      return {
        intent: INTENT_TYPES.TREATMENT_SEARCH,
        concern: null,
        ingredient: null,
        product_type: null,
        skin_type: null,
        price_sensitivity: null,
        brand: null,
        user_segment: USER_SEGMENTS.CONCERN_FOCUSED_NOVICES
      };
    }
  }

  /**
   * Parse query with user context for personalized search
   */
  async parseQueryWithContext(query, userContext = null) {
    // First parse the basic query
    const basicParsedQuery = await this.parseQuery(query);
    
    // If no user context, return basic parsing
    if (!userContext || !userContext.preferences) {
      return basicParsedQuery;
    }

    const prefs = userContext.preferences;
    
    // Enhance parsed query with user context
    const enhancedQuery = {
      ...basicParsedQuery,
      
      // Override user segment with profile-based segment if available
      user_segment: prefs.userSegment || basicParsedQuery.user_segment,
      
      // Use profile skin type if not mentioned in query
      skin_type: basicParsedQuery.skin_type || prefs.skin.skinType,
      
      // Use profile price sensitivity if not mentioned in query
      price_sensitivity: basicParsedQuery.price_sensitivity || prefs.priceRange,
      
      // Add user context for personalization
      userContext: {
        skinType: prefs.skin.skinType,
        skinConcerns: prefs.skin.concerns,
        skinSensitivity: prefs.skin.sensitivity,
        avoidIngredients: prefs.avoidIngredients,
        preferredIngredients: prefs.preferredIngredients,
        priceRange: prefs.priceRange,
        age: prefs.age,
        gender: prefs.gender,
        climate: prefs.lifestyle.climate,
        location: prefs.lifestyle.location,
        profileCompleteness: prefs.profileCompleteness
      }
    };

    // If query doesn't specify concern but user has primary concerns, use those
    if (!enhancedQuery.concern && prefs.skin.concerns.length > 0) {
      enhancedQuery.concern = prefs.skin.concerns[0]; // Use primary concern
    }

    return enhancedQuery;
  }

  /**
   * Step 3: Rank products based on query and user context, with match reasons
   */
  async rankProducts(products, parsedQuery, limit = 4) {
    if (!products || products.length === 0) {
      return [];
    }

    // If price sensitivity is the main factor, sort by price first with simple reasons
    if (parsedQuery.price_sensitivity === 'budget' || parsedQuery.user_segment === USER_SEGMENTS.VALUE_HUNTERS) {
      products.sort((a, b) => {
        const priceA = parseFloat(a.price_sale) || parseFloat(a.price_mrp) || 0;
        const priceB = parseFloat(b.price_sale) || parseFloat(b.price_mrp) || 0;
        return priceA - priceB;
      });
      return products.slice(0, limit).map((product, index) => ({
        ...product,
        match_reason: index === 0 ? 'Most budget-friendly option with good value' : 'Good value for money'
      }));
    }

    // Build personalization context for AI ranking
    let personalizationContext = '';
    if (parsedQuery.userContext) {
      const ctx = parsedQuery.userContext;
      personalizationContext = `
User Profile Context:
- Skin Type: ${ctx.skinType || 'Not specified'}
- Primary Skin Concerns: ${ctx.skinConcerns?.join(', ') || 'Not specified'}
- Skin Sensitivity: ${ctx.skinSensitivity || 'Not specified'}
- Ingredients to Avoid: ${ctx.avoidIngredients?.join(', ') || 'None specified'}
- Preferred Ingredients: ${ctx.preferredIngredients?.join(', ') || 'None specified'}
- Age: ${ctx.age || 'Not specified'}
- Gender: ${ctx.gender || 'Not specified'}
- Climate: ${ctx.climate || 'Not specified'}
- Location: ${ctx.location || 'Not specified'}
- Profile Completeness: ${ctx.profileCompleteness}%
`;
    }

    // For other segments, use AI ranking with detailed reasons
    const prompt = `
You are a skincare expert. Rank the following products based on the user query and their personal profile, providing specific reasons why each product is suitable for this user.

User Query Analysis:
- Intent: ${parsedQuery.intent}
- Concern: ${parsedQuery.concern || 'Not specified'}
- Ingredient: ${parsedQuery.ingredient || 'Not specified'}
- Product Type: ${parsedQuery.product_type || 'Not specified'}
- Skin Type: ${parsedQuery.skin_type || 'Not specified'}
- User Segment: ${parsedQuery.user_segment}
- Price Sensitivity: ${parsedQuery.price_sensitivity || 'Not specified'}

${personalizationContext}

Products to rank:
${products.map((product, index) => `
${index + 1}. ${product.brand_name} ${product.product_name}
   Price: ₹${product.price_sale || product.price_mrp}
   Rating: ${product.rating_avg}/5 (${product.rating_count} reviews)
   Key Ingredients: ${this.extractKeyIngredients(product)}
   Benefits: ${this.extractKeyBenefits(product)}
`).join('\n')}

Rank these products from most relevant to least relevant for this user and provide specific match reasons.

${personalizationContext ? `
IMPORTANT: Use the user's profile information to:
- Prioritize products suitable for their skin type and concerns
- Avoid or deprioritize products with ingredients they should avoid
- Highlight products with their preferred ingredients
- Consider their age, gender, and climate for recommendations
- Match their price sensitivity and user segment preferences
` : ''}

Return ONLY a JSON array with this structure:
[
  {
    "productIndex": 3,
    "matchReason": "Natural, user-friendly reason why this product is perfect for them"
  },
  {
    "productIndex": 1,  
    "matchReason": "Friendly explanation for this product's relevance"
  }
]

For each product, provide a natural, conversational reason (40-80 characters) that sounds like friendly advice:

${personalizationContext ? `
For personalized users, create friendly messages that reference their specific profile:
- Use their skin type naturally: "Perfect for your oily skin"
- Reference their concerns: "Great for tackling acne" 
- Mention preferred ingredients: "Has your favorite niacinamide"
- Sound encouraging: "Ideal choice for you", "Perfect match"
- Be specific but warm: "Gentle on sensitive skin like yours"

For the #1 ranked product, make it sound especially recommended and personal.
` : `
For non-personalized users, create friendly general messages:
- "Highly recommended choice"
- "Great for your skin concern"  
- "Popular and effective option"
- "Well-reviewed product"
`}

Example personalized reasons:
- "Perfect for your oily, acne-prone skin!"
- "Has niacinamide - your preferred ingredient"
- "Gentle formula ideal for sensitive skin like yours"
- "Great anti-aging choice for your age group"
- "Matches your ingredient-conscious preferences"

Example general reasons:
- "Highly rated for acne-prone skin"
- "Popular choice with great reviews"
- "Effective for oil control"
- "Well-formulated anti-aging option"
`;

    try {
      const result = await geminiWrapper.generateContent('flash', prompt);
      const response = result.text;
      
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        // Fallback: return products sorted by rating with generic reasons
        return products
          .sort((a, b) => (parseFloat(b.rating_avg) || 0) - (parseFloat(a.rating_avg) || 0))
          .slice(0, limit)
          .map((product, index) => ({
            ...product,
            match_reason: index === 0 ? 'Top-rated option for your needs' : 'Highly rated and relevant'
          }));
      }
      
      const rankingWithReasons = JSON.parse(jsonMatch[0]);
      
      // Reorder products based on AI ranking and add match reasons
      const rankedProducts = rankingWithReasons
        .map(item => {
          const product = products[item.productIndex - 1];
          if (product) {
            return {
              ...product,
              match_reason: item.matchReason
            };
          }
          return null;
        })
        .filter(product => product) // Remove any undefined products
        .slice(0, limit);
      
      return rankedProducts;
    } catch (error) {
      Logger.error('Error ranking products with Gemini', { error: error.message });
      // Fallback: return products sorted by rating with generic reasons
      return products
        .sort((a, b) => (parseFloat(b.rating_avg) || 0) - (parseFloat(a.rating_avg) || 0))
        .slice(0, limit)
        .map((product, index) => ({
          ...product,
          match_reason: index === 0 ? 'Top-rated option for your needs' : 'Highly rated and relevant'
        }));
    }
  }

  /**
   * Generate ingredient highlights for the results page
   */
  async generateIngredientHighlights(parsedQuery, relevantIngredients) {
    if (!relevantIngredients || relevantIngredients.length === 0) {
      return [];
    }

    const prompt = `
Based on the user's skincare concern and query, provide brief, engaging descriptions for these ingredients.

User Query Analysis:
- Concern: ${parsedQuery.concern || 'General skincare'}
- Skin Type: ${parsedQuery.skin_type || 'Not specified'}
- User Segment: ${parsedQuery.user_segment}

Ingredients: ${relevantIngredients.join(', ')}

For each ingredient, provide:
- Name
- Brief benefit (20-30 words)
- Why it's relevant for this user's concern

Return as JSON array:
[{"name": "ingredient", "benefit": "short description", "relevance": "why good for this concern"}]
`;

    try {
      const result = await geminiWrapper.generateContent('flash', prompt);
      const response = result.text;
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
      Logger.error('Error generating ingredient highlights', { error: error.message });
      return [];
    }
  }

  /**
   * Validate parsed query structure
   */
  validateParsedQuery(data) {
    const requiredFields = ['intent', 'user_segment'];
    for (const field of requiredFields) {
      if (!data.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Extract key ingredients from product for display
   */
  extractKeyIngredients(product) {
    if (!product.ingredients) return 'Not specified';
    
    try {
      const ingredients = typeof product.ingredients === 'string' 
        ? JSON.parse(product.ingredients) 
        : product.ingredients;
      
      return Array.isArray(ingredients) 
        ? ingredients.slice(0, 3).join(', ') 
        : 'Not specified';
    } catch {
      return 'Not specified';
    }
  }

  /**
   * Extract key benefits from product for display
   */
  extractKeyBenefits(product) {
    if (!product.benefits_extracted) return 'Not specified';
    
    try {
      const benefits = Array.isArray(product.benefits_extracted) 
        ? product.benefits_extracted 
        : JSON.parse(product.benefits_extracted);
      
      return benefits.slice(0, 3).join(', ');
    } catch {
      return 'Not specified';
    }
  }
}

module.exports = new GeminiService(); 