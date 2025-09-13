// Test script for the gentle reflection prompt
const testJournalEntry = "I feel so drained after social events. I just want to be alone.";

const testReflection = async () => {
  try {
    const response = await fetch('http://localhost:8000/api/reflect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ journalEntry: testJournalEntry })
    });
    
    const result = await response.json();
    console.log('\n=== Test Journal Entry ===');
    console.log(testJournalEntry);
    console.log('\n=== AI Reflection Response ===');
    console.log(result.reflection);
    console.log('\n=== Word Count ===');
    console.log(`Words: ${result.reflection.split(' ').length}`);
    
    // Test fallback for short input
    const shortResponse = await fetch('http://localhost:8000/api/reflect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ journalEntry: "Hi" })
    });
    
    const shortResult = await shortResponse.json();
    console.log('\n=== Short Input Test ===');
    console.log('Input: "Hi"');
    console.log('Fallback Response:', shortResult.reflection);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

testReflection();