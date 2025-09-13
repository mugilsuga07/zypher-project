// Comprehensive Safety Interceptor Testing Script
// Tests all safety mechanisms implemented in Part 3

const testCases = [
  // Input Validator Tests
  {
    name: "Empty Input Test",
    input: "",
    expectedType: "fallback",
    description: "Should trigger empty input fallback"
  },
  {
    name: "Short Input Test",
    input: "Hi",
    expectedType: "fallback", 
    description: "Should trigger short input fallback (<3 words)"
  },
  {
    name: "Long Input Test",
    input: "This is an extremely long journal entry that goes on and on about various topics and feelings and experiences that might overwhelm the system. ".repeat(10),
    expectedType: "fallback",
    description: "Should trigger long input fallback (>300 words)"
  },
  
  // Valid Input Tests
  {
    name: "Valid Emotional Input",
    input: "I feel overwhelmed by social situations and need some quiet time to recharge.",
    expectedType: "reflection",
    description: "Should generate a gentle reflection response"
  },
  {
    name: "Valid Sensory Input",
    input: "The lights in the office are too bright today and it's making me feel anxious.",
    expectedType: "reflection",
    description: "Should generate supportive response about sensory experiences"
  },
  
  // Edge Cases
  {
    name: "Whitespace Only",
    input: "   \n\t   ",
    expectedType: "fallback",
    description: "Should treat whitespace-only as empty input"
  },
  {
    name: "Exactly 3 Words",
    input: "I feel tired",
    expectedType: "reflection",
    description: "Should pass validation with exactly 3 words"
  },
  {
    name: "Complex Emotional State",
    input: "I'm struggling with changes at work and feeling like I can't keep up with everything that's happening around me.",
    expectedType: "reflection",
    description: "Should generate gentle, non-overwhelming response"
  }
];

async function testSafetyInterceptors() {
  console.log("🔍 Testing InnerSense Safety Interceptors\n");
  console.log("=" .repeat(60));
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📝 Test ${i + 1}: ${testCase.name}`);
    console.log(`Input: "${testCase.input.substring(0, 100)}${testCase.input.length > 100 ? '...' : ''}"`); 
    console.log(`Expected: ${testCase.expectedType}`);
    console.log(`Description: ${testCase.description}`);
    
    try {
      const response = await fetch('http://localhost:8000/api/reflect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ journalEntry: testCase.input })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const reflection = data.reflection;
      
      // Count words in response
      const wordCount = reflection.trim().split(/\s+/).length;
      
      console.log(`Response (${wordCount} words): "${reflection}"`);
      
      // Analyze response type
      const isFallback = [
        "Thanks for sharing. Take your time — your thoughts matter.",
        "I'm here when you're ready. There's no pressure to explain everything.", 
        "Even small thoughts are worth noticing. You're doing great.",
        "That sounds like a lot to carry. You don't have to explain more than you want. I'm here."
      ].includes(reflection);
      
      const actualType = isFallback ? "fallback" : "reflection";
      
      // Check if test passed
      const testPassed = actualType === testCase.expectedType;
      
      if (testPassed) {
        console.log(`✅ PASSED - Got expected ${actualType}`);
        passedTests++;
      } else {
        console.log(`❌ FAILED - Expected ${testCase.expectedType}, got ${actualType}`);
      }
      
      // Additional safety checks for reflection responses
      if (actualType === "reflection") {
        const safetyIssues = [];
        
        // Check word limit
        if (wordCount > 100) {
          safetyIssues.push(`Word count exceeded (${wordCount} > 100)`);
        }
        
        // Check for unsafe words
        const unsafeWords = ["should", "must", "fix", "wrong", "failure", "broken"];
        const lowerResponse = reflection.toLowerCase();
        const foundUnsafeWords = unsafeWords.filter(word => lowerResponse.includes(word));
        if (foundUnsafeWords.length > 0) {
          safetyIssues.push(`Contains unsafe words: ${foundUnsafeWords.join(', ')}`);
        }
        
        if (safetyIssues.length > 0) {
          console.log(`⚠️  Safety Issues: ${safetyIssues.join('; ')}`);
        } else {
          console.log(`🛡️  Safety checks passed`);
        }
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
    
    console.log("-".repeat(40));
  }
  
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  console.log(`Success Rate: ${Math.round((passedTests/totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log(`\n🎉 All safety interceptors working correctly!`);
  } else {
    console.log(`\n⚠️  Some tests failed - review safety interceptor implementation`);
  }
}

// Run the tests
testSafetyInterceptors().catch(console.error);