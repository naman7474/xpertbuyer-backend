// Debug script to check beauty_profiles table constraints
const supabase = require('./src/config/database');

async function checkConstraints() {
  try {
    console.log('🔍 Checking beauty_profiles table constraints...\n');

    // Query to get all check constraints for beauty_profiles table
    const { data: constraints, error } = await supabase.rpc('sql', {
      query: `
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(c.oid) as constraint_definition
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE t.relname = 'beauty_profiles' 
        AND c.contype = 'c'
        ORDER BY conname;
      `
    });

    if (error) {
      console.error('❌ Error fetching constraints:', error);
      
      // Alternative approach - describe the table
      console.log('\n🔍 Trying alternative approach - describing table structure...\n');
      
      const { data: tableInfo, error: tableError } = await supabase
        .from('beauty_profiles')
        .select('*')
        .limit(0);
        
      if (tableError) {
        console.error('❌ Error describing table:', tableError);
      } else {
        console.log('✅ Table structure verified - columns exist');
      }
      
      return;
    }

    console.log('✅ Found constraints:');
    constraints.forEach((constraint, index) => {
      console.log(`${index + 1}. ${constraint.constraint_name}`);
      console.log(`   ${constraint.constraint_definition}\n`);
    });

    // Test specific problematic values
    console.log('🧪 Testing problematic values...\n');
    
    const testValues = {
      skin_type: ['dry', 'oily', 'combination', 'normal', 'sensitive', 'INVALID'],
      stress_level: ['low', 'moderate', 'high', 'severe', 'very_high'],
      pollution_level: ['low', 'moderate', 'high', 'severe', 'very_high']
    };

    for (const [field, values] of Object.entries(testValues)) {
      console.log(`\n📋 Testing ${field}:`);
      for (const value of values) {
        try {
          // Try to create a test record with this value
          const testData = {
            user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
            [field]: value
          };
          
          if (field === 'skin_type') {
            testData.skin_tone = 'medium';
            testData.undertone = 'neutral';
          }
          
          const { error: testError } = await supabase
            .from('beauty_profiles')
            .insert(testData)
            .select();
            
          if (testError) {
            if (testError.message.includes('violates check constraint')) {
              console.log(`   ❌ "${value}" - REJECTED by constraint`);
            } else if (testError.message.includes('violates foreign key')) {
              console.log(`   ⚠️  "${value}" - Would be accepted (foreign key error expected)`);
            } else {
              console.log(`   ❓ "${value}" - Other error: ${testError.message}`);
            }
          } else {
            console.log(`   ✅ "${value}" - ACCEPTED`);
            // Clean up - this shouldn't happen due to foreign key
          }
        } catch (err) {
          console.log(`   ❓ "${value}" - Exception: ${err.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the check
checkConstraints().then(() => {
  console.log('\n✅ Constraint check complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
}); 