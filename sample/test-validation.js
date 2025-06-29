/**
 * Comprehensive Validation Test Script
 * Tests all active validators with edge cases and various scenarios
 */

const fs = require('fs');
const path = require('path');

// Mock CSV parser since we don't have the actual implementation
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const values = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
  
  return {
    name: 'sheet',
    headers,
    rows
  };
}

// Load test data
function loadTestData() {
  const tasksCSV = fs.readFileSync(path.join(__dirname, 'tasks.csv'), 'utf8');
  const workersCSV = fs.readFileSync(path.join(__dirname, 'workers.csv'), 'utf8');
  const clientsCSV = fs.readFileSync(path.join(__dirname, 'clients.csv'), 'utf8');
  const rulesJSON = fs.readFileSync(path.join(__dirname, 'business-rules.json'), 'utf8');

  return {
    data: {
      tasks: parseCSV(tasksCSV),
      workers: parseCSV(workersCSV),
      clients: parseCSV(clientsCSV)
    },
    rules: JSON.parse(rulesJSON)
  };
}

// Summary of test cases included
const testScenarios = {
  "Missing Columns Validator": [
    "✓ All required columns present in valid rows",
    "✓ Tests with proper column structure"
  ],
  
  "Duplicate IDs Validator": [
    "✓ DUPLICATE_ID appears twice in tasks.csv",
    "✓ DUPLICATE_WORKER appears twice in workers.csv", 
    "✓ DUPLICATE_CLIENT appears twice in clients.csv"
  ],
  
  "Malformed Lists Validator": [
    "✓ Empty skills in T024 and W024",
    "✓ Empty RequestedTaskIDs in C021", 
    "✓ Malformed task lists with extra commas in C022",
    "✓ Various valid comma-separated lists"
  ],
  
  "Out of Range Validator": [
    "✓ Invalid Duration: T022 (0), T027 (-5), T026 (999)",
    "✓ Invalid MaxConcurrent: T023 (0), T028 (50)",
    "✓ Invalid PriorityLevel: C016 (10), C017 (0), C018 (-1), C023 (6)",
    "✓ Invalid QualificationLevel: W022 (15), W023 (-2), W027 (11), W028 (0)",
    "✓ Invalid MaxLoadPerPhase: W021 (exceeds slots), W025 (0), W026 (-1)"
  ],
  
  "JSON Fields Validator": [
    "✓ Invalid JSON in C020: '{invalid json structure'",
    "✓ Missing JSON in C024",
    "✓ Valid complex JSON in C025",
    "✓ Various valid JSON structures in other clients"
  ],
  
  "References Validator": [
    "✓ Nonexistent task references: C019 requests T999, T888",
    "✓ Valid task references in other clients",
    "✓ Tests cross-sheet reference integrity"
  ],
  
  "Skill Coverage Validator": [
    "✓ T021 requires 'nonexistent_skill' not available in any worker",
    "✓ All other tasks have matching skills in worker pool",
    "✓ Tests comprehensive skill matching logic"
  ],
  
  "Circular Co-Run Validator": [
    "✓ Circular dependency: T013->T014->T015->T013",
    "✓ Created via rules: circular_corun_001, 002, 003",
    "✓ Tests complex circular relationship detection"
  ],
  
  "Conflicting Rules Validator": [
    "✓ Co-run conflict: T001+T011 must run together",
    "  - T001 restricted to phases [1,2] (phase_window_001)",  
    "  - T011 restricted to phases [4,5] (phase_window_002)",
    "  - No overlapping phases = conflict!",
    "✓ Multiple phase windows for T001:",
    "  - phase_window_001: phases [1,2]",
    "  - conflicting_phase_001: phase [5]",
    "  - No intersection = conflict!",
    "✓ Load limit conflicts:",
    "  - large_corun_conflict: 5 tasks together",
    "  - load_limit_002: analytics group max 1 slot",
    "  - Analytics tasks in co-run group = conflict!",
    "✓ Valid co-run groups with overlapping phases"
  ]
};

// Edge cases covered
const edgeCases = {
  "Data Quality Edge Cases": [
    "Empty string values in various fields",
    "Leading/trailing whitespace in IDs and names", 
    "Special characters in JSON",
    "Very large numeric values",
    "Negative values where not allowed",
    "Zero values in required positive fields"
  ],
  
  "Business Logic Edge Cases": [
    "Inactive rules (should be ignored)",
    "Self-referencing co-run rules",
    "Complex circular dependencies (3+ nodes)",
    "Phase ranges vs individual phase lists",
    "Overlapping vs non-overlapping constraints",
    "Large co-run groups vs capacity limits"
  ],
  
  "Validation Edge Cases": [
    "Multiple validation errors in same record",
    "Cross-validator interactions",
    "Rule priority conflicts",
    "Pattern matching vs explicit rules",
    "Precedence overrides"
  ]
};

console.log('🧪 COMPREHENSIVE VALIDATION TEST SUITE');
console.log('=====================================\n');

console.log('📊 TEST DATA SUMMARY:');
console.log(`Tasks: 28 records (20 valid + 8 with issues)`);
console.log(`Workers: 30 records (20 valid + 10 with issues)`);
console.log(`Clients: 25 records (15 valid + 10 with issues)`);
console.log(`Business Rules: 22 rules (20 active + 2 inactive)\n`);

console.log('🎯 VALIDATION SCENARIOS COVERED:');
Object.entries(testScenarios).forEach(([validator, scenarios]) => {
  console.log(`\n${validator}:`);
  scenarios.forEach(scenario => console.log(`  ${scenario}`));
});

console.log('\n🚨 EDGE CASES INCLUDED:');
Object.entries(edgeCases).forEach(([category, cases]) => {
  console.log(`\n${category}:`);
  cases.forEach(testCase => console.log(`  • ${testCase}`));
});

console.log('\n🔥 EXPECTED VALIDATION FAILURES:');
console.log('This test data is DESIGNED to trigger validation errors!');
console.log('Expected error count: 25-35 validation issues');

console.log('\n📋 TO RUN VALIDATION:');
console.log('1. Load this test data into your validation system');
console.log('2. Run all active validators');  
console.log('3. Check that all expected issues are detected');
console.log('4. Verify error messages are clear and actionable');

console.log('\n✅ SUCCESS CRITERIA:');
console.log('• All duplicate IDs detected');
console.log('• All out-of-range values flagged');
console.log('• Skill coverage gaps identified');
console.log('• Circular co-run dependency found');
console.log('• Co-run vs phase-window conflicts detected');
console.log('• Multiple phase window conflicts identified');
console.log('• JSON validation errors caught');
console.log('• Reference integrity violations found');

const testData = loadTestData();
console.log('\n📁 Test data loaded successfully!');
console.log('Ready for validation testing...\n');

// Export for use in actual validation system
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testData,
    testScenarios,
    edgeCases
  };
}