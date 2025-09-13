import { AnthropicModelProvider, ZypherAgent } from "@corespeed/zypher";
import { eachValueFrom } from "rxjs-for-await";

// Conversation interfaces
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  createdAt: Date;
  lastActivity: Date;
}

// Helper function to safely get environment variables
function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

// ConversationAgent Class - Extends ReflectionAgent with conversational capabilities
class ConversationAgent {
  private agent: ZypherAgent;
  private conversations: Map<string, ConversationSession> = new Map();
  private maxConversationHistory = 10; // Keep last 10 messages for context
  private conversationsFilePath = './conversations.json';
  
  constructor() {
    this.agent = new ZypherAgent(
      new AnthropicModelProvider({
        apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
      })
    );
    // Load conversations asynchronously on startup
    this.loadConversations().catch(console.error);
  }

  // Load conversations from file
  private async loadConversations(): Promise<void> {
    try {
      const data = await Deno.readTextFile(this.conversationsFilePath);
      const conversationsData = JSON.parse(data);
      
      // Convert plain objects back to Map with proper Date objects
      for (const [id, conv] of Object.entries(conversationsData)) {
        const conversation = conv as any;
        const session: ConversationSession = {
          id: conversation.id,
          messages: conversation.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })),
          createdAt: new Date(conversation.createdAt),
          lastActivity: new Date(conversation.lastActivity)
        };
        this.conversations.set(id, session);
      }
      console.log(`📚 Loaded ${this.conversations.size} conversations from storage`);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      console.log('📝 Starting with fresh conversation storage');
    }
  }

  // Save conversations to file
  private async saveConversations(): Promise<void> {
    try {
      const conversationsData = Object.fromEntries(this.conversations);
      await Deno.writeTextFile(this.conversationsFilePath, JSON.stringify(conversationsData, null, 2));
    } catch (error) {
      console.error('❌ Failed to save conversations:', error);
    }
  }

  // Generate unique conversation ID
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create or get conversation session
  getOrCreateConversation(conversationId?: string): ConversationSession {
    if (conversationId && this.conversations.has(conversationId)) {
      const conversation = this.conversations.get(conversationId)!;
      conversation.lastActivity = new Date();
      return conversation;
    }

    const newConversation: ConversationSession = {
      id: conversationId || this.generateConversationId(),
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.conversations.set(newConversation.id, newConversation);
    return newConversation;
  }

  // Add message to conversation
  private async addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<ConversationMessage> {
    const conversation = this.getOrCreateConversation(conversationId);
    const message: ConversationMessage = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: new Date()
    };

    conversation.messages.push(message);
    conversation.lastActivity = new Date();

    // Keep only recent messages for context
    if (conversation.messages.length > this.maxConversationHistory) {
      conversation.messages = conversation.messages.slice(-this.maxConversationHistory);
    }

    // Auto-save conversations after each message
    await this.saveConversations();

    return message;
  }

  // Get conversation history for context
  getConversationHistory(conversationId: string): ConversationMessage[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.messages : [];
  }

  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Generate contextual engagement prompts based on conversation patterns
  private getEngagementStrategy(conversationHistory: ConversationMessage[], userMessage: string): string {
    const recentMessages = conversationHistory.slice(-3);
    const userMessages = recentMessages.filter(m => m.role === 'user');
    
    // Analyze conversation patterns for better engagement
    const isFirstMessage = conversationHistory.length === 0;
    const hasShortResponses = userMessages.some(m => m.content.length < 50);
    const hasEmotionalContent = /feel|emotion|happy|sad|angry|excited|worried|anxious|love|hate/i.test(userMessage);
    const hasPersonalContent = /i am|i'm|my|me|myself/i.test(userMessage.toLowerCase());
    
    let engagementHints = "\nEngagement Focus: ";
    
    if (isFirstMessage) {
      engagementHints += "This is the start of our conversation - be welcoming and ask an open-ended question to learn more about them.";
    } else if (hasEmotionalContent) {
      engagementHints += "The user shared emotional content - validate their feelings and ask how they're processing this experience.";
    } else if (hasPersonalContent) {
      engagementHints += "The user shared something personal - show genuine interest and ask for more details about their experience.";
    } else if (hasShortResponses) {
      engagementHints += "The user has been giving brief responses - try a different angle or ask about their interests to re-engage them.";
    } else {
      engagementHints += "Keep the conversation flowing by building on what they've shared and exploring related topics.";
    }
    
    return engagementHints;
  }

  // Summarize older messages to save tokens
  private summarizeOldMessages(messages: ConversationMessage[]): string {
    if (messages.length === 0) return "";
    const topics = messages.map(m => m.content.substring(0, 50)).join(", ");
    return `[Earlier conversation covered: ${topics}...]`;
  }

  // Create conversational prompt with context
  private createConversationalPrompt(userMessage: string, conversationHistory: ConversationMessage[]): string {
    let contextString = "";
    
    if (conversationHistory.length > 0) {
      contextString = "\n\nConversation history:\n";
      
      // If we have more than 4 messages, summarize older ones
      if (conversationHistory.length > 4) {
        const oldMessages = conversationHistory.slice(0, -4);
        const recentMessages = conversationHistory.slice(-4);
        
        contextString += this.summarizeOldMessages(oldMessages) + "\n";
        
        for (const msg of recentMessages) {
          contextString += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
      } else {
        // Include all messages if 4 or fewer
        for (const msg of conversationHistory) {
          contextString += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
      }
      contextString += "\n";
    }

    // Get contextual engagement strategy
    const engagementStrategy = this.getEngagementStrategy(conversationHistory, userMessage);

    const prompt = `You are a helpful AI assistant. Respond naturally and always end with a follow-up question${engagementStrategy}

${contextString}User: ${userMessage}

Assistant:`;
    
    // Log token usage
    const estimatedTokens = this.estimateTokens(prompt);
    console.log(`🔢 Conversation prompt tokens: ~${estimatedTokens} (context: ${conversationHistory.length} msgs)`);
    
    return prompt;
  }

  // Main conversational method
  async generateConversationalResponse(userMessage: string, conversationId?: string): Promise<{ response: string; conversationId: string; messageId: string }> {
    await this.agent.init();

    // Get or create conversation
    const conversation = this.getOrCreateConversation(conversationId);
    
    // Add user message to conversation
    const userMessageObj = await this.addMessage(conversation.id, 'user', userMessage);

    // Get conversation history for context
    const history = this.getConversationHistory(conversation.id).slice(0, -1); // Exclude current message
    
    // Create conversational prompt
    const prompt = this.createConversationalPrompt(userMessage, history);

    // Generate response
    const event$ = this.agent.runTask(prompt, "claude-sonnet-4-20250514");
    
    let response = "";
    for await (const event of eachValueFrom(event$)) {
      if (event.type === 'text' && event.content) {
        response += event.content;
      }
    }

    response = response.trim();

    // Return response
    const assistantMessage = await this.addMessage(conversation.id, 'assistant', response);
    return {
      response,
      conversationId: conversation.id,
      messageId: assistantMessage.id
    };
  }

  // All safety interceptors removed - this is now a simple conversational chatbot
}

// InnerSense ReflectionAgent Class (Legacy - keeping for compatibility)
class ReflectionAgent {
  private agent: ZypherAgent;
  
  constructor() {
    this.agent = new ZypherAgent(
      new AnthropicModelProvider({
        apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
      })
    );
  }

  // All safety interceptors removed - this is now a simple reflection generator

  // Zypher gentle_reflection_prompt template
  private createGentleReflectionPrompt(userJournalEntry: string): string {
    const prompt = `You are a compassionate journaling companion. Respond kindly and briefly (1-3 sentences, ≤100 words). Acknowledge and validate without giving advice.

User journal entry: "${userJournalEntry}"

Generate a gentle, validating reflection:`;
    
    // Log token usage
    const estimatedTokens = Math.ceil(prompt.length / 4);
    console.log(`🔢 Reflection prompt tokens: ~${estimatedTokens}`);
    
    return prompt;
  }

  // Simple reflection generation without safety interceptors
  async generateReflection(journalEntry: string): Promise<string> {
    try {
      // Initialize agent if not done
      await this.agent.init();

      // Generate reflection prompt
      const prompt = this.createGentleReflectionPrompt(journalEntry);
      
      // Use Claude Haiku for simple reflections (shorter entries) to save costs
      const model = journalEntry.length < 100 ? "claude-haiku-3-20240307" : "claude-sonnet-4-20250514";
      console.log(`🤖 Using model: ${model} for reflection (entry length: ${journalEntry.length})`);
      
      // Run the reflection task
      const event$ = this.agent.runTask(prompt, model);
      
      let response = "";
      for await (const event of eachValueFrom(event$)) {
        if (event.type === 'text' && event.content) {
          response += event.content;
        }
      }

      return response.trim();
      
    } catch (error) {
      console.error('ReflectionAgent error:', error);
      throw error;
    }
  }
}

// Web Server Setup
const reflectionAgent = new ReflectionAgent();
const conversationAgent = new ConversationAgent();

// Serve React build files from dist directory (fallback to development files)
async function serveStaticFile(pathname: string): Promise<Response> {
  let filePath = pathname;
  
  // Default to index.html for root path and SPA routing
  if (filePath === '/' || (!filePath.includes('.') && !filePath.startsWith('/api'))) {
    filePath = '/index.html';
  }
  
  try {
    // Try to serve from React build directory first
     let fullPath = `./dist${filePath}`;
     let file: Uint8Array;
     
     try {
       file = await Deno.readFile(fullPath);
     } catch {
       // Fallback to development files if build doesn't exist
       if (filePath === '/index.html') {
         fullPath = './index.html';
       } else {
         fullPath = `./public${filePath}`;
       }
       file = await Deno.readFile(fullPath);
     }
    
    // Determine content type
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'jsx': 'application/javascript',
      'ts': 'application/typescript',
      'tsx': 'application/typescript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml'
    };
    
    const contentType = contentTypes[ext || ''] || 'text/plain';
    
    return new Response(new Uint8Array(file), {
         headers: { 
           'Content-Type': contentType,
           'Cache-Control': filePath.includes('/assets/') ? 'public, max-age=31536000' : 'no-cache'
         }
       });
  } catch {
    // For SPA routing, return index.html for non-API routes
    if (!filePath.startsWith('/api')) {
      try {
         const indexFile = await Deno.readFile('./index.html');
          return new Response(new Uint8Array(indexFile), {
             headers: { 'Content-Type': 'text/html' }
           });
      } catch {
        return new Response('App not found', { status: 404 });
      }
    }
    return new Response('File not found', { status: 404 });
  }
}

// API Handler
async function handleAPI(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  console.log(`🔍 API Request: ${request.method} ${pathname}`);

  // Handle GET requests for conversation history
  if (request.method === 'GET' && pathname === '/api/conversation/history') {
    const conversationId = url.searchParams.get('conversationId');
    
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'Conversation ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const history = conversationAgent.getConversationHistory(conversationId);
    
    return new Response(
      JSON.stringify({ messages: history }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();

    // Conversational endpoint
    if (pathname === '/api/conversation') {
      const { message, conversationId } = body;
      console.log(`💬 Processing message: "${message}" (conversationId: ${conversationId || 'new'})`);

      if (!message) {
        return new Response(
          JSON.stringify({ error: 'Message is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      const result = await conversationAgent.generateConversationalResponse(message, conversationId);
      
      return new Response(
        JSON.stringify(result),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Legacy reflection endpoint
    if (pathname === '/api/reflect') {
      const { journalEntry } = body;
      const reflection = await reflectionAgent.generateReflection(journalEntry);
      
      return new Response(JSON.stringify({ reflection }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to process request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Main server handler
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  
  if (url.pathname.startsWith('/api/')) {
    return handleAPI(request);
  }
  
  return serveStaticFile(url.pathname);
}

// Start the server
const port = 8000;
console.log(`🌟 InnerSense Web App starting on http://localhost:${port}`);
Deno.serve({ port }, handler);