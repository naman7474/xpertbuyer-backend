Step 1: Extract Structured Parameters. 

The LLM prompted to parse a raw search string into slots (intent, entities, attributes). For example, a prompt might instruct Gemini: “Identify the user’s primary intent (e.g. solve skin concern, compare products, purchase), and extract key attributes (skin type, concern, ingredient, brand, price-sensitivity) and map it to a user segment from the query.”. 

The model then returns a structured JSON 
 {
    "intent": "treatment_search", 
    "concern": "acne", 
    "ingredient": null, 
    "product_type": "face wash"
    "skin_type": "oily"
    "price_sensitivity": "budget"
    "user_segment": "Ingredient-Conscious"
}

This leverages the LLM’s strong pattern recognition: as shown in instructional prompts, Gemini can “determine the user’s primary goal” and “identify specific details or entities relevant to the intent”


Step 2: Retrieve Relevant Products. 

With the structured intent and identified segment, we can now retrieve relevant products. The easiest approach is semantic search: pre-compute embeddings for all product titles, ingredients, descriptions, and other relevant attributes (via Gemini or an open model) and store them in a vector database. For a given query, embed it and retrieve nearest products by cosine similarity. This leverages embeddings capturing product attributes and user needs. For instance, if the query is “niacinamide serum for acne”, its embedding will be close to products containing niacinamide and marketed for acne, regardless of exact wording.

Step 3: Rank Products. 

With the retrieved products, we can now rank them based on relevance and user preferences. The easiest approach is to use the LLM to rank the products based on the query and the user segment. For instance, if the query is “niacinamide serum for acne” and the user segment is “Ingredient-Conscious”, the LLM can rank the products based on the ingredients and the acne concern. If the concern is pricing then we just return the products in the order of price. If the concern is efficacy then we rank the products based on the ingredients and the acne concern.


Step 4: Return Results. 

With the ranked products, we can now return the results to the user. The easiest approach is to return the products in a list format. For instance, if the query is “niacinamide serum for acne” and the user segment is “Ingredient-Conscious”, the LLM can return the products in a list format.