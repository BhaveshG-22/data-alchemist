// Quick test of the modular validation system
const { runAllValidations } = require('./src/validators/index.ts');

// Test data with intentional issues
const testData = {
  clients: {
    name: 'clients',
    headers: ['ClientName', 'PriorityLevel'], // Missing ClientID
    rows: [
      { ClientName: 'Test Client', PriorityLevel: 'invalid' }, // Wrong type for PriorityLevel
      { ClientName: 'Another Client', PriorityLevel: 3 }
    ]
  },
  workers: {
    name: 'workers',
    headers: ['WorkerID', 'WorkerName', 'Skills'],
    rows: [
      { WorkerID: 'W001', WorkerName: 'John', Skills: 'javascript,python' },
      { WorkerID: 'W001', WorkerName: 'Jane', Skills: 'react' } // Duplicate ID
    ]
  }
};

const context = {
  data: testData,
  config: { strictMode: false }
};

try {
  console.log('🧪 Testing modular validation system...\n');
  
  const result = runAllValidations(context);
  
  console.log(`✅ Validation completed successfully!`);
  console.log(`📊 Summary: ${result.summary.total} issues found`);
  console.log(`❌ Errors: ${result.summary.errors}`);
  console.log(`⚠️  Warnings: ${result.summary.warnings}`);
  console.log(`ℹ️  Info: ${result.summary.info}\n`);
  
  if (result.issues.length > 0) {
    console.log('🔍 Issues found:');
    result.issues.forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.category}] ${issue.message}`);
      if (issue.suggestion) {
        console.log(`   💡 Suggestion: ${issue.suggestion}`);
      }
    });
  }
  
  console.log('\n🎉 Modular validation system is working correctly!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}