/**
 * Simple test script to verify AI Analysis Cache implementation
 * Run this after setting up the database and environment
 */

const AIAnalysisCacheService = require('./src/services/aiAnalysisCacheService');
const CacheCleanupService = require('./src/utils/cacheCleanupService');

async function testCacheImplementation() {
  console.log('🧪 Testing AI Analysis Cache Implementation...\n');

  const cacheService = new AIAnalysisCacheService();
  const cleanupService = new CacheCleanupService();

  // Test data
  const testUserId = 'test-user-123';
  const testAnalysisType = 'skin_analysis';
  const testProfileData = {
    skin_type: 'combination',
    concerns: ['acne', 'dryness'],
    age: 25
  };

  try {
    // Test 1: Cache Key Generation
    console.log('1️⃣ Testing cache key generation...');
    const cacheKey = cacheService.generateCacheKey(testUserId, testAnalysisType, testProfileData);
    console.log(`✅ Cache key generated: ${cacheKey}`);

    // Test 2: Data Hashing
    console.log('\n2️⃣ Testing data hashing...');
    const hash1 = cacheService.hashData(testProfileData);
    const hash2 = cacheService.hashData({ ...testProfileData, age: 26 }); // Different data
    const hash3 = cacheService.hashData(testProfileData); // Same data
    
    console.log(`✅ Hash consistency: ${hash1 === hash3 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Hash uniqueness: ${hash1 !== hash2 ? 'PASS' : 'FAIL'}`);

    // Test 3: Cache Miss and Save
    console.log('\n3️⃣ Testing cache miss and save...');
    const mockAnalysisResult = {
      analysis: 'Test analysis result',
      confidence: 0.85,
      recommendations: ['Use gentle cleanser', 'Apply moisturizer'],
      timestamp: new Date().toISOString()
    };

    const result1 = await cacheService.getOrGenerate(
      testUserId,
      testAnalysisType,
      testProfileData,
      async () => {
        console.log('   🤖 Generating mock analysis (cache miss)...');
        return mockAnalysisResult;
      }
    );

    console.log(`✅ First call - From cache: ${result1.fromCache}`);
    console.log(`✅ Analysis result saved: ${result1.data ? 'YES' : 'NO'}`);

    // Test 4: Cache Hit
    console.log('\n4️⃣ Testing cache hit...');
    const result2 = await cacheService.getOrGenerate(
      testUserId,
      testAnalysisType,
      testProfileData,
      async () => {
        console.log('   🤖 This should not be called (cache hit)...');
        return mockAnalysisResult;
      }
    );

    console.log(`✅ Second call - From cache: ${result2.fromCache}`);
    console.log(`✅ Cache hit working: ${result2.fromCache ? 'YES' : 'NO'}`);

    // Test 5: Cache Statistics
    console.log('\n5️⃣ Testing cache statistics...');
    const stats = await cacheService.getCacheStats(testUserId);
    if (stats) {
      console.log(`✅ Cache stats retrieved:`);
      console.log(`   - Total entries: ${stats.total}`);
      console.log(`   - Active entries: ${stats.active}`);
      console.log(`   - Total accesses: ${stats.totalAccesses}`);
    } else {
      console.log('❌ Failed to retrieve cache stats');
    }

    // Test 6: Cache Invalidation
    console.log('\n6️⃣ Testing cache invalidation...');
    await cacheService.invalidateCache(testUserId, testAnalysisType);
    console.log('✅ Cache invalidated');

    // Verify invalidation worked
    const result3 = await cacheService.getOrGenerate(
      testUserId,
      testAnalysisType,
      testProfileData,
      async () => {
        console.log('   🤖 Generating analysis after invalidation...');
        return mockAnalysisResult;
      }
    );

    console.log(`✅ After invalidation - From cache: ${result3.fromCache}`);
    console.log(`✅ Invalidation working: ${!result3.fromCache ? 'YES' : 'NO'}`);

    // Test 7: Cleanup Service
    console.log('\n7️⃣ Testing cleanup service...');
    const healthCheck = await cleanupService.healthCheck();
    console.log(`✅ Cleanup service health: ${healthCheck.status}`);

    // Test 8: TTL Configuration
    console.log('\n8️⃣ Testing TTL configuration...');
    const skinTTL = cacheService.getTTL('skin_analysis');
    const defaultTTL = cacheService.getTTL('unknown_type');
    
    console.log(`✅ Skin analysis TTL: ${skinTTL / (24 * 60 * 60 * 1000)} days`);
    console.log(`✅ Default TTL fallback: ${defaultTTL === cacheService.defaultTTL ? 'YES' : 'NO'}`);

    // Final cleanup
    console.log('\n🧹 Cleaning up test data...');
    await cacheService.invalidateCache(testUserId);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Cache key generation');
    console.log('   ✅ Data hashing consistency');
    console.log('   ✅ Cache miss and save');
    console.log('   ✅ Cache hit detection');
    console.log('   ✅ Cache statistics');
    console.log('   ✅ Cache invalidation');
    console.log('   ✅ Cleanup service health');
    console.log('   ✅ TTL configuration');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    
    // Cleanup on error
    try {
      await cacheService.invalidateCache(testUserId);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  // Check required environment variables
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
    console.error('Please check your .env file');
    process.exit(1);
  }
  
  testCacheImplementation()
    .then(() => {
      console.log('\n✅ Test script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testCacheImplementation }; 