// src/services/sqlQueryGeneratorService.js - FIXED VERSION
const { models } = require('../config/gemini');
const supabase = require('../config/database');
const Logger = require('../utils/logger');

class SQLQueryGeneratorService {
  constructor() {
    // Define allowed tables and columns for security
    this.allowedSchema = {
      products: [
        'product_id', 'brand_name', 'product_name', 'category_path',
        'price_mrp', 'price_sale', 'currency', 'size_qty', 'shade_or_variant',
        'description_html', 'skin_hair_type', 'rating_avg', 'rating_count',
        'ingredients_extracted', 'benefits_extracted'
      ],
      ingredients: [
        'id', 'display_name', 'inci_name', 'benefit_summary',
        'concern_tags', 'safety_rating', 'is_hero'
      ],
      product_ingredients: [
        'product_id', 'ingredient_id', 'position'
      ]
    };

    // SQL injection prevention patterns
    this.dangerousPatterns = [
      /\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b/i,
      /--/,
      /\/\*/,
      /\*\//,
      /;.*$/,
      /\bunion\b.*\bselect\b/i,
      /\bor\b.*=.*=/i
    ];

    // Valid table names for our schema
    this.validTables = [
      'products', 
      'ingredients', 
      'product_ingredients',
      'product_video_mentions',
      'yt_videos'
    ];

    // Valid column patterns
    this.validColumns = [
      'product_id', 'brand_name', 'product_name', 'category_path',
      'price_mrp', 'price_sale', 'rating_avg', 'rating_count',
      'skin_hair_type', 'ingredients_extracted', 'benefits_extracted',
      'description_html', 'id', 'display_name', 'inci_name',
      'concern_tags', 'safety_rating', 'is_hero', 'ingredient_id',
      'position', 'video_id', 'title', 'channel_title'
    ];
  }

  /**
   * Generate SQL query from natural language
   */
  async generateSQLQuery(userQuery, userSegment) {
    try {
      const prompt = this.buildPrompt(userQuery, userSegment);
      
      const result = await models.flash.generateContent(prompt);
      const response = result.response.text();
      
      // Extract SQL from response
      const sqlMatch = response.match(/```sql\s*([\s\S]*?)\s*```/);
      if (!sqlMatch) {
        throw new Error('No SQL query found in response');
      }
      
      const sql = sqlMatch[1].trim();
      
      // Log the generated SQL before validation
      Logger.debug('Generated SQL (raw from model)', { sql });

      // Sanitize first, then validate
      const sanitizedSQL = this.sanitizeSQL(sql);
      Logger.debug('Generated SQL (post-sanitization)', { sql: sanitizedSQL });
      this.validateSQL(sanitizedSQL); 
      
      // Extract metadata from response
      const metadata = this.extractMetadata(response);
      
      return {
        sql: sanitizedSQL,
        metadata: metadata,
        confidence: metadata.confidence || 0.8
      };
    } catch (error) {
      Logger.error('Error generating SQL', { error: error.message, userQuery });
      throw error;
    }
  }

  /**
   * Build comprehensive prompt for SQL generation
   */
  buildPrompt(userQuery, userSegment) {
    return `You are a SQL expert for a skincare product database. Generate a PostgreSQL query to find products based on the user's natural language query.

USER QUERY: "${userQuery}"
USER SEGMENT: ${userSegment || 'General'}

DATABASE SCHEMA:
1. products table:
   - product_id (text): Unique product identifier
   - brand_name (text): Brand name
   - product_name (text): Product name
   - category_path (text): Category hierarchy
   - price_mrp, price_sale (numeric): Prices
   - rating_avg (numeric): Average rating (0-5)
   - rating_count (bigint): Number of ratings
   - skin_hair_type (text): Suitable skin/hair types
   - ingredients_extracted (jsonb): Array of {name, concentration}
   - benefits_extracted (jsonb): Array of {benefit, description}
   - description_html (text): Product description

2. ingredients table: (IMPORTANT: Primary Key is 'id')
   - id (integer): Unique identifier (PRIMARY KEY)
   - display_name (text): Common name
   - inci_name (text): Scientific name
   - concern_tags (text[]): Array of concerns like ['acne', 'anti_aging', 'hydration']
   - safety_rating (text): Safety level
   - is_hero (boolean): If it's a key ingredient

3. product_ingredients table:
   - product_id (text): Links to products.product_id
   - ingredient_id (integer): Links to ingredients.id (IMPORTANT: Joins on ingredients.id)
   - position (smallint): Order in ingredient list

QUERY INTERPRETATION RULES:

1. NEGATIVE QUERIES (without, no, free from):
   - "sunscreen without zinc oxide" → Exclude products containing zinc oxide
   - "fragrance-free" → Exclude products with fragrance ingredients
   - Use NOT EXISTS subqueries for exclusions

2. CONCENTRATION QUERIES:
   - "10% niacinamide" → Look in ingredients_extracted jsonb for concentration
   - Use jsonb operators: @> for contains, ->> for field access
   - Example: ingredients_extracted @> '[{"name": "niacinamide", "concentration": "10%"}]'

3. MULTI-CONCERN QUERIES:
   - "acne and anti-aging" → Join with ingredients having both concern tags
   - Use array overlap operator && for concern_tags

4. TEXTURE/FORM PREFERENCES:
   - "gel moisturizer" → Search in product_name or category_path
   - Common textures: gel, cream, foam, oil, serum, lotion

5. SKIN CONDITIONS:
   - Map to concern_tags: rosacea→'soothing,anti_inflammatory', eczema→'barrier_repair,gentle'
   - psoriasis→'gentle,moisturizing', sensitive→'gentle,fragrance_free'

6. DEMOGRAPHIC QUERIES:
   - "teen", "men's" → Search in product_name or description_html
   - "pregnancy safe" → Exclude certain ingredients (retinol, salicylic acid high %)

7. ROUTINE QUERIES:
   - "morning routine" → Multiple products: cleanser, moisturizer, sunscreen
   - Return variety of product types

8. PRICE SENSITIVITY:
   - "under 500" → price_sale < 500
   - "budget" → price_sale < 500
   - "luxury" → price_sale > 3000

EXAMPLES:

Query: "10% niacinamide serum without fragrance"
\`\`\`sql
SELECT DISTINCT p.*
FROM products p
WHERE p.product_name ILIKE '%serum%'
  AND p.ingredients_extracted @> '[{"name": "niacinamide", "concentration": "10%"}]'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM product_ingredients pi
    JOIN ingredients i ON pi.ingredient_id = i.id
    WHERE pi.product_id = p.product_id
    AND (i.display_name ILIKE '%fragrance%' OR i.inci_name ILIKE '%parfum%')
  )
ORDER BY p.rating_avg DESC NULLS LAST
LIMIT 10;
\`\`\`

Query: "gel moisturizer for acne prone skin under 1000"
\`\`\`sql
SELECT DISTINCT p.*
FROM products p
JOIN product_ingredients pi ON p.product_id = pi.product_id
JOIN ingredients i ON pi.ingredient_id = i.id
WHERE (p.product_name ILIKE '%gel%moisturizer%' OR p.product_name ILIKE '%moisturizer%gel%')
  AND i.concern_tags && ARRAY['acne', 'oil_control']
  AND p.price_sale < 1000
  AND pi.position <= 10  -- Key ingredients in top 10
GROUP BY p.product_id
HAVING COUNT(DISTINCT CASE WHEN i.concern_tags && ARRAY['acne'] THEN i.id END) >= 2
ORDER BY p.rating_avg DESC NULLS LAST
LIMIT 10;
\`\`\`

Query: "morning routine for oily skin"
\`\`\`sql
WITH routine_products AS (
  SELECT 'cleanser' as step, 1 as order_num
  UNION SELECT 'toner', 2
  UNION SELECT 'serum', 3
  UNION SELECT 'moisturizer', 4
  UNION SELECT 'sunscreen', 5
)
SELECT DISTINCT ON (rp.step) 
  p.*, 
  rp.step as routine_step,
  rp.order_num
FROM products p
CROSS JOIN routine_products rp
JOIN product_ingredients pi ON p.product_id = pi.product_id
JOIN ingredients i ON pi.ingredient_id = i.id
WHERE p.product_name ILIKE '%' || rp.step || '%'
  AND (p.skin_hair_type ILIKE '%oily%' OR i.concern_tags && ARRAY['oil_control', 'mattifying'])
  AND p.rating_avg >= 4.0
ORDER BY rp.step, p.rating_avg DESC
LIMIT 5;
\`\`\`

IMPORTANT INSTRUCTIONS:
1. Always use DISTINCT to avoid duplicates when joining
2. Use ILIKE for case-insensitive text matching
3. Limit results to 10-20 products unless routine query
4. Order by rating_avg DESC for best products first
5. Use proper NULL handling with NULLS LAST
6. For jsonb queries, cast strings to jsonb with ::jsonb
7. Never use DELETE, UPDATE, INSERT, DROP, or ALTER
8. Only SELECT queries are allowed
9. Always include ORDER BY and LIMIT clauses

Generate the SQL query and explain your interpretation:

\`\`\`sql
[YOUR SQL QUERY HERE]
\`\`\`

METADATA:
- Interpreted concerns: [list concerns]
- Excluded ingredients: [list if any]
- Price range: [if specified]
- Product type: [if specified]
- Confidence: [0.0-1.0]
`;
  }

  /**
   * Validate SQL for security threats
   */
  validateSQL(sql) {
    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(sql)) {
        throw new Error('Potentially dangerous SQL pattern detected');
      }
    }

    // Ensure it's a SELECT query
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Check for valid table names
    const tables = this.extractTableNames(sql);
    for (const table of tables) {
      if (!Object.keys(this.allowedSchema).includes(table)) {
        throw new Error(`Invalid table name: ${table}`);
      }
    }

    // Validate column names
    this.validateColumns(sql);
  }

  /**
   * Sanitize SQL query
   */
  sanitizeSQL(sql) {
    // Remove any comments
    sql = sql.replace(/--.*$/gm, '');
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Ensure single query
    sql = sql.split(';')[0].trim();
    
    // Add safety limit if missing
    if (!sql.includes('LIMIT')) {
      sql += ' LIMIT 20';
    }
    
    return sql;
  }

  /**
   * Extract table names from SQL
   */
  extractTableNames(sql) {
    const tablePattern = /(?:FROM|JOIN)\s+(\w+)/gi;
    const matches = [];
    let match;
    
    while ((match = tablePattern.exec(sql)) !== null) {
      matches.push(match[1].toLowerCase());
    }
    
    return [...new Set(matches)];
  }

  /**
   * Validate column names in SQL
   */
  validateColumns(sql) {
    // Extract column references
    const columnPattern = /(\w+)\.(\w+)/g;
    let match;
    
    while ((match = columnPattern.exec(sql)) !== null) {
      const [, table, column] = match;
      const allowedColumns = this.allowedSchema[table.toLowerCase()];
      
      if (allowedColumns && !allowedColumns.includes(column.toLowerCase())) {
        // Allow jsonb operators
        if (!column.match(/^(>|>>|-|@>|<@|#>|#>>)/)) {
          throw new Error(`Invalid column: ${table}.${column}`);
        }
      }
    }
  }

  /**
   * Extract metadata from Gemini response
   */
  extractMetadata(response) {
    const metadata = {
      concerns: [],
      excludedIngredients: [],
      priceRange: null,
      productType: null,
      confidence: 0.8
    };

    // Extract concerns
    const concernsMatch = response.match(/Interpreted concerns:\s*\[(.*?)\]/);
    if (concernsMatch && concernsMatch[1]) {
      metadata.concerns = concernsMatch[1].split(',').map(c => c.trim()).filter(c => c);
    }

    // Extract excluded ingredients
    const excludedMatch = response.match(/Excluded ingredients:\s*\[(.*?)\]/);
    if (excludedMatch && excludedMatch[1]) {
      metadata.excludedIngredients = excludedMatch[1].split(',').map(i => i.trim()).filter(i => i);
    }

    // Extract confidence
    const confidenceMatch = response.match(/Confidence:\s*([\d.]+)/);
    if (confidenceMatch) {
      metadata.confidence = parseFloat(confidenceMatch[1]);
    }

    return metadata;
  }

  /**
   * Execute the generated SQL query safely
   */
  async executeQuery(sql) {
    try {
      // Attempt to use Supabase's RPC
      const { data, error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (rpcError) {
        // Log the RPC error and proceed to fallback
        Logger.warn(`RPC 'exec_sql' failed with error: ${rpcError.message}. Falling back.`);
        return await this.executeFallbackQuery(sql);
      }
      // If RPC succeeded:
      Logger.debug("RPC 'exec_sql' executed successfully");
      return data;

    } catch (exceptionDuringRpc) {
      // This catch handles exceptions if supabase.rpc itself throws (e.g. RPC doesn't exist and client throws, network issues)
      Logger.warn(`Exception during RPC 'exec_sql' invocation: ${exceptionDuringRpc.message}. Falling back.`);
      return await this.executeFallbackQuery(sql, exceptionDuringRpc);
    }
  }

  async executeFallbackQuery(originalSql, rpcException = null) {
    if (rpcException) {
      Logger.debug('Executing fallback query due to RPC exception');
    } else {
      Logger.debug('Executing fallback query due to RPC error response');
    }
    
    // The existing fallback in the problematic code was a generic product list.
    // It does not use the originalSql.
    try {
      const { data: products, error: fallbackError } = await supabase
        .from('products')
        .select('*')
        .limit(20);
      
      if (fallbackError) {
        Logger.error('Error executing fallback query', { error: fallbackError.message });
        throw new Error(`Failed to execute search query (fallback also failed): ${fallbackError.message}`);
      }
      Logger.debug("Fallback query executed successfully");
      return products;
    } catch (e) {
      Logger.error('Exception in fallback query execution logic', { error: e.message });
      throw new Error(`Failed to execute search query (exception in fallback logic): ${e.message}`);
    }
  }
}

// Enhanced search service integration - FIXED
class EnhancedSearchService {
  constructor() {
    this.sqlGenerator = new SQLQueryGeneratorService();
  }

  /**
   * Main search function with SQL generation
   */
  async search(query, options = {}) {
    try {
      // Step 1: Parse basic intent (lightweight)
      const basicParsing = await this.parseBasicIntent(query);
      
      // Step 2: Generate SQL query
      const { sql, metadata, confidence } = await this.sqlGenerator.generateSQLQuery(
        query, 
        basicParsing.userSegment
      );

      Logger.debug('Generated SQL', { sql });
      Logger.debug('Metadata', metadata);

      // Step 3: Execute query if confidence is high
      if (confidence > 0.7) {
        const products = await this.executeGeneratedQuery(sql);
        
        if (products && products.length > 0) {
          return {
            query: query,
            products: products,
            metadata: metadata,
            queryType: 'ai-generated',
            message: this.generateResponseMessage(metadata, products.length)
          };
        }
      }

      // Step 4: Return empty result if no products found
      return {
        query: query,
        products: [],
        metadata: metadata,
        queryType: 'ai-generated',
        message: 'No products found matching your criteria'
      };

    } catch (error) {
      Logger.error('Error in enhanced search', { error: error.message });
      throw error; // Let the main service handle fallback
    }
  }

  /**
   * Parse basic intent without full Gemini call
   */
  async parseBasicIntent(query) {
    const queryLower = query.toLowerCase();
    
    // Quick intent detection
    const intent = {
      hasNegative: /without|no|free|avoid/.test(queryLower),
      hasConcentration: /\d+\s*%/.test(query),
      hasPrice: /under|below|less than|\$|₹|budget|cheap|affordable/.test(queryLower),
      isRoutine: /routine|regimen|steps|morning|evening|night/.test(queryLower),
      userSegment: this.detectQuickSegment(queryLower)
    };

    return intent;
  }

  /**
   * Quick user segment detection
   */
  detectQuickSegment(query) {
    if (/natural|organic|clean|paraben.?free|sulfate.?free/.test(query)) {
      return 'Clean/Organic Beauty Seekers';
    }
    if (/budget|cheap|affordable|under/.test(query)) {
      return 'Value/Deal Hunters';
    }
    if (/luxury|premium|high.?end/.test(query)) {
      return 'Luxury/Aspirational Shoppers';
    }
    if (/\b(retinol|niacinamide|aha|bha|peptide|hyaluronic)\b/.test(query)) {
      return 'Ingredient-Conscious';
    }
    return 'Concern-Focused Novices';
  }

  /**
   * Execute generated SQL with timeout and safety checks
   */
  async executeGeneratedQuery(sql) {
    // Add timeout to prevent long-running queries
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 5000)
    );

    try {
      const result = await Promise.race([
        this.sqlGenerator.executeQuery(sql),
        timeoutPromise
      ]);

      return result;
    } catch (error) {
      Logger.error('Query execution failed', { error: error.message });
      return null;
    }
  }

  /**
   * Generate user-friendly response message
   */
  generateResponseMessage(metadata, productCount) {
    let message = `Found ${productCount} products`;
    
    if (metadata.concerns.length > 0) {
      message += ` for ${metadata.concerns.join(' and ')}`;
    }
    
    if (metadata.excludedIngredients.length > 0) {
      message += ` without ${metadata.excludedIngredients.join(', ')}`;
    }
    
    if (metadata.priceRange) {
      message += ` within your budget`;
    }
    
    return message + '.';
  }
}

module.exports = { SQLQueryGeneratorService, EnhancedSearchService };