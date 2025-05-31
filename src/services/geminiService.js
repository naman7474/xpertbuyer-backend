const { models } = require('../config/gemini');
const { USER_SEGMENTS, INTENT_TYPES } = require('../constants/userSegments');

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
      const result = await models.flash.generateContent(prompt);
      const response = result.response.text();
      
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
      console.error('Error parsing query with Gemini:', error);
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
   * Step 3: Rank products based on query and user segment
   */
  async rankProducts(products, parsedQuery, limit = 4) {
    if (!products || products.length === 0) {
      return [];
    }

    // If price sensitivity is the main factor, sort by price first
    if (parsedQuery.price_sensitivity === 'budget' || parsedQuery.user_segment === USER_SEGMENTS.VALUE_HUNTERS) {
      products.sort((a, b) => {
        const priceA = parseFloat(a.price_sale) || parseFloat(a.price_mrp) || 0;
        const priceB = parseFloat(b.price_sale) || parseFloat(b.price_mrp) || 0;
        return priceA - priceB;
      });
      return products.slice(0, limit);
    }

    // For other segments, use AI ranking
    const prompt = `
You are a skincare expert. Rank the following products based on the user query and segment.

User Query Analysis:
- Intent: ${parsedQuery.intent}
- Concern: ${parsedQuery.concern || 'Not specified'}
- Ingredient: ${parsedQuery.ingredient || 'Not specified'}
- Product Type: ${parsedQuery.product_type || 'Not specified'}
- Skin Type: ${parsedQuery.skin_type || 'Not specified'}
- User Segment: ${parsedQuery.user_segment}
- Price Sensitivity: ${parsedQuery.price_sensitivity || 'Not specified'}

Products to rank:
${products.map((product, index) => `
${index + 1}. ${product.brand_name} ${product.product_name}
   Price: ₹${product.price_sale || product.price_mrp}
   Rating: ${product.rating_avg}/5 (${product.rating_count} reviews)
   Key Ingredients: ${this.extractKeyIngredients(product)}
   Benefits: ${this.extractKeyBenefits(product)}
`).join('\n')}

Rank these products from most relevant to least relevant for this user.
Return ONLY a JSON array of product indices (1-based) in order of relevance.
Example: [3, 1, 4, 2]

Consider:
- Relevance to user's concern and intent
- Ingredient match (especially for Ingredient-Conscious users)
- Price appropriateness for user segment
- Product ratings and reviews
- Brand reputation for the user segment
`;

    try {
      const result = await models.flash.generateContent(prompt);
      const response = result.response.text();
      
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\d,\s]+\]/);
      if (!jsonMatch) {
        // Fallback: return products sorted by rating
        return products
          .sort((a, b) => (parseFloat(b.rating_avg) || 0) - (parseFloat(a.rating_avg) || 0))
          .slice(0, limit);
      }
      
      const ranking = JSON.parse(jsonMatch[0]);
      
      // Reorder products based on AI ranking
      const rankedProducts = ranking
        .map(index => products[index - 1])
        .filter(product => product) // Remove any undefined products
        .slice(0, limit);
      
      return rankedProducts;
    } catch (error) {
      console.error('Error ranking products with Gemini:', error);
      // Fallback: return products sorted by rating
      return products
        .sort((a, b) => (parseFloat(b.rating_avg) || 0) - (parseFloat(a.rating_avg) || 0))
        .slice(0, limit);
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
- Intent: ${parsedQuery.intent}
- User Segment: ${parsedQuery.user_segment}

Ingredients:
${relevantIngredients.map(ing => `
- ${ing.display_name}: ${ing.benefit_summary}
  Concerns: ${ing.concern_tags?.join(', ') || 'General'}
`).join('\n')}

For each ingredient, provide a 1-2 sentence highlight that explains why it's relevant for the user's concern.
Return as JSON array:
[
  {
    "ingredient": "ingredient_name",
    "highlight": "brief description of why it's good for their concern"
  }
]
`;

    try {
      const result = await models.flash.generateContent(prompt);
      const response = result.response.text();
      
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return relevantIngredients.map(ing => ({
          ingredient: ing.display_name,
          highlight: ing.benefit_summary
        }));
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating ingredient highlights:', error);
      return relevantIngredients.map(ing => ({
        ingredient: ing.display_name,
        highlight: ing.benefit_summary
      }));
    }
  }

  /**
   * Helper methods
   */
  validateParsedQuery(data) {
    const validIntents = Object.values(INTENT_TYPES);
    const validSegments = Object.values(USER_SEGMENTS);
    
    if (!validIntents.includes(data.intent)) {
      data.intent = INTENT_TYPES.TREATMENT_SEARCH;
    }
    
    if (!validSegments.includes(data.user_segment)) {
      data.user_segment = USER_SEGMENTS.CONCERN_FOCUSED_NOVICES;
    }
  }

  extractKeyIngredients(product) {
    if (product.ingredients_extracted && Array.isArray(product.ingredients_extracted)) {
      return product.ingredients_extracted
        .slice(0, 3)
        .map(ing => ing.name)
        .join(', ');
    }
    return 'Not specified';
  }

  extractKeyBenefits(product) {
    if (product.benefits_extracted && Array.isArray(product.benefits_extracted)) {
      return product.benefits_extracted
        .slice(0, 3)
        .map(benefit => benefit.benefit)
        .join(', ');
    }
    return 'Not specified';
  }
}

module.exports = new GeminiService(); 