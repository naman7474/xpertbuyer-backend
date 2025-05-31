const USER_SEGMENTS = {
  CONCERN_FOCUSED_NOVICES: 'Concern-Focused Novices',
  INGREDIENT_CONSCIOUS: 'Ingredient-Conscious',
  CLEAN_ORGANIC: 'Clean/Organic Beauty Seekers',
  BRAND_FOCUSED: 'Brand-Focused',
  VALUE_HUNTERS: 'Value/Deal Hunters',
  LUXURY_ASPIRATIONAL: 'Luxury/Aspirational Shoppers'
};

const SEGMENT_CHARACTERISTICS = {
  [USER_SEGMENTS.CONCERN_FOCUSED_NOVICES]: {
    description: 'Low product knowledge; shop by visible problems or goals',
    commonQueries: [
      'oily skin solution',
      'face wash for oily skin',
      'how to get rid of pimples',
      'acne treatment at home',
      'dry skin moisturizer for sensitive skin',
      'dark circles home remedies',
      'frizzy hair treatment',
      'glowing skin tips India'
    ],
    rankingFactors: ['concern_match', 'simplicity', 'effectiveness']
  },
  [USER_SEGMENTS.INGREDIENT_CONSCIOUS]: {
    description: 'High awareness of skincare science; search by active ingredients',
    commonQueries: [
      'niacinamide serum benefits',
      'best niacinamide serum India',
      'salicylic acid face wash for acne',
      'hyaluronic acid serum vs vitamin C',
      'retinol cream for wrinkles',
      'dermaloxyl peptide skin care',
      'chemical sunscreen vs mineral sunscreen'
    ],
    rankingFactors: ['ingredient_quality', 'concentration', 'scientific_backing']
  },
  [USER_SEGMENTS.CLEAN_ORGANIC]: {
    description: 'Value-driven consumers who prioritize natural, sustainable products',
    commonQueries: [
      'paraben free moisturizer for face',
      'organic vitamin C serum India',
      'cruelty free nail polish brands',
      'herbal shampoo for hair fall',
      'Ayurvedic fairness cream',
      'sulfate-free body wash'
    ],
    rankingFactors: ['natural_ingredients', 'certifications', 'sustainability']
  },
  [USER_SEGMENTS.BRAND_FOCUSED]: {
    description: 'Familiar with specific brands or products',
    commonQueries: [
      'Lakmé absolute lip shade',
      'Lakme eyeliner',
      'Loreal Revitalift cream price online',
      'Nykaa best selling serums',
      'Maybelline vs Lakme lipstick',
      'Clinique foundation review',
      'Buy Cosrx Niacinamide'
    ],
    rankingFactors: ['brand_reputation', 'product_reviews', 'availability']
  },
  [USER_SEGMENTS.VALUE_HUNTERS]: {
    description: 'Price-conscious or deal-seeking shoppers',
    commonQueries: [
      'affordable face serum India',
      'best cheap sunscreen SPF50',
      'budget skin care routine',
      'discount on Lakme Kajal',
      'patanjali products price list',
      'drugstore alternatives to serums'
    ],
    rankingFactors: ['price', 'value_for_money', 'discounts']
  },
  [USER_SEGMENTS.LUXURY_ASPIRATIONAL]: {
    description: 'Seek premium brands and high-end products',
    commonQueries: [
      'best anti aging serum India',
      'Estee Lauder night repair review',
      'premium cruelty-free makeup brands',
      'La Mer repair cream price',
      'luxury perfume online India',
      'high-end hair treatments keratin'
    ],
    rankingFactors: ['premium_quality', 'brand_prestige', 'exclusivity']
  }
};

const INTENT_TYPES = {
  TREATMENT_SEARCH: 'treatment_search',
  INGREDIENT_LOOKUP: 'ingredient_lookup',
  PRODUCT_COMPARISON: 'product_comparison',
  BRAND_EXPLORATION: 'brand_exploration',
  PRICE_COMPARISON: 'price_comparison',
  GENERAL_INQUIRY: 'general_inquiry'
};

module.exports = {
  USER_SEGMENTS,
  SEGMENT_CHARACTERISTICS,
  INTENT_TYPES
}; 