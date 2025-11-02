"""
GPT Service Module
Handles all OpenAI API calls using Assistants API
"""
import json
import openai
import time
import re
from typing import List, Dict, Optional


class GPTService:
    def __init__(self, api_key: str):
        """Initialize the OpenAI client"""
        self.client = openai.OpenAI(api_key=api_key)
        self.model = "gpt-4-turbo-preview"  # gpt-4 doesn't support file_search
    
    def upload_file(self, file_path: str) -> str:
        """
        Upload the actual document file to OpenAI
        
        Args:
            file_path: Path to the document file (DOCX)
            
        Returns:
            File ID from OpenAI
        """
        # Upload the actual DOCX file to OpenAI
        with open(file_path, 'rb') as file:
            file_obj = self.client.files.create(
                file=file,
                purpose='assistants'
            )
        return file_obj.id
    
    def create_assistant(self) -> str:
        """
        Create an assistant for document analysis
        
        Returns:
            Assistant ID
        """
        assistant_config = {
            "name": "Legal Document Filler",
            "instructions": """You are a helpful assistant that helps users fill in legal documents.

CRITICAL RULES:
1. You MUST ALWAYS ask questions to the user. NEVER make up values or guess information.
2. You CANNOT provide replacements until the user has answered your questions.
3. You MUST have a conversation with the user - this is REQUIRED, not optional.
4. You MUST carefully read and understand the entire document context before asking questions.
5. Ask SPECIFIC, RELEVANT questions based on the document's context and purpose.

Your workflow:
1. First, thoroughly analyze the attached document to understand:
   - What type of document it is (contract, agreement, form, etc.)
   - The context and purpose of the document
   - All dynamic placeholders (e.g., [CLIENT_NAME], {{DATE}}, [AMOUNT], etc.)
   - The relationship between placeholders and the document structure

2. After identifying placeholders, IMMEDIATELY start asking the user SPECIFIC questions based on the document context:
   - Reference the document context when asking (e.g., "I see this is a service agreement. What is the client's full legal name?")
   - Ask ONE question at a time in a friendly, conversational manner
   - Make questions relevant to the document's purpose and context
   - If a placeholder seems unclear, ask clarifying questions about what information is needed

3. Wait for the user's response before asking the next question

4. Extract information from user responses as they answer

5. Continue asking questions until you have gathered ALL information needed for ALL placeholders

6. ONLY when you have gathered ALL information from the user (after multiple questions and answers), say EXACTLY: "I have all the information needed. Let me complete the document now."

7. Then provide a JSON response with:
   - "placeholders": List of all placeholders found with their exact names as they appear in the document
   - "replacements": Object mapping placeholder names EXACTLY as they appear in the document to their values (ONLY use values the user provided)

Example conversation flow:
- You: "I've analyzed your document and see it's a service agreement. I found several placeholders that need to be filled. Let me start by asking: What is the client's full legal name?"
- User: "John Doe"
- You: "Thank you. What is the date this agreement should be signed?"
- User: "2024-01-15"
- You: "I have all the information needed. Let me complete the document now."
{
  "placeholders": [
    {"name": "CLIENT_NAME", "type": "string", "context": "Client's full name"},
    {"name": "DATE", "type": "date", "context": "Date of signing"}
  ],
  "replacements": {
    "CLIENT_NAME": "John Doe",
    "DATE": "2024-01-15"
  }
}

IMPORTANT:
- NEVER provide replacements in your first message - you MUST ask questions first
- NEVER make up or guess values - ONLY use values the user provides
- Be conversational and friendly
- Ask one question at a time
- Make questions SPECIFIC and RELEVANT to the document context
- Understand the document's purpose before asking questions
- The replacement mapping should be returned as valid JSON, no markdown formatting
- Placeholder names in replacements MUST match EXACTLY how they appear in the document (including brackets, braces, etc.)""",
            "model": self.model,
            "tools": [{"type": "file_search"}]
        }
        
        assistant = self.client.beta.assistants.create(**assistant_config)
        return assistant.id
    
    def create_thread(self) -> str:
        """
        Create a new conversation thread
        
        Returns:
            Thread ID
        """
        thread = self.client.beta.threads.create()
        return thread.id
    
    def request_partial_replacements(self, thread_id: str, assistant_id: str) -> Optional[Dict]:
        """
        Request GPT to provide replacements for whatever information it has gathered so far
        Even if the conversation is incomplete
        
        Args:
            thread_id: The thread ID
            assistant_id: The assistant ID
            
        Returns:
            Dict with placeholders and replacements, or None if not found
        """
        # Send a message asking GPT to provide replacements for what it has
        request_message = """Please provide a JSON response with all the replacements you have gathered so far from the conversation, even if some placeholders are still missing.

Format your response as JSON with this structure:
{
  "placeholders": [
    {"name": "PLACEHOLDER_NAME", "type": "string", "context": "Description"},
    ...
  ],
  "replacements": {
    "PLACEHOLDER_NAME": "value from user",
    ...
  }
}

Important:
- Include ONLY values that the user has actually provided
- Use placeholder names EXACTLY as they appear in the document (with brackets/braces)
- If you don't have a value for a placeholder, do NOT include it in replacements
- Return valid JSON, no markdown formatting"""
        
        self.send_message(thread_id, request_message)
        
        # Run assistant
        run_id = self.run_assistant(thread_id, assistant_id)
        
        # Wait for response
        run_result = self.wait_for_run(thread_id, run_id)
        
        if run_result["status"] == "completed":
            # Extract the JSON response
            mapping = self.extract_replacement_mapping(thread_id)
            return mapping
        
        return None
    
    def send_message(self, thread_id: str, message: str, file_ids: Optional[List[str]] = None) -> None:
        """
        Send a message to the thread
        
        Args:
            thread_id: The thread ID
            message: The message content
            file_ids: Optional list of file IDs to attach to the message
        """
        message_params = {
            "thread_id": thread_id,
            "role": "user",
            "content": message
        }
        
        if file_ids:
            message_params["attachments"] = [
                {"file_id": file_id, "tools": [{"type": "file_search"}]} 
                for file_id in file_ids
            ]
        
        self.client.beta.threads.messages.create(**message_params)
    
    def run_assistant(self, thread_id: str, assistant_id: str) -> str:
        """
        Run the assistant on the thread
        
        Args:
            thread_id: The thread ID
            assistant_id: The assistant ID
            
        Returns:
            Run ID
        """
        run = self.client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id
        )
        return run.id
    
    def wait_for_run(self, thread_id: str, run_id: str, timeout: int = 60) -> Dict:
        """
        Wait for the assistant run to complete with rate limit handling
        
        Args:
            thread_id: The thread ID
            run_id: The run ID
            timeout: Maximum time to wait in seconds
            
        Returns:
            Run status and response
        """
        start_time = time.time()
        retry_count = 0
        max_retries = 5
        
        while time.time() - start_time < timeout:
            try:
                run = self.client.beta.threads.runs.retrieve(
                    thread_id=thread_id,
                    run_id=run_id
                )
                
                if run.status == "completed":
                    return {"status": "completed", "run": run}
                elif run.status == "failed":
                    error_info = run.last_error if hasattr(run, 'last_error') else {}
                    # Check if it's a rate limit error in the run status
                    if hasattr(run, 'last_error') and run.last_error:
                        if hasattr(run.last_error, 'code') and 'rate_limit' in str(run.last_error.code).lower():
                            wait_time = self._extract_wait_time_from_error(str(run.last_error))
                            return {
                                "status": "rate_limited",
                                "error": {"message": str(run.last_error), "wait_time": wait_time}
                            }
                    return {"status": "failed", "error": error_info}
                elif run.status in ["cancelled", "expired"]:
                    return {"status": run.status}
                
                # Reset retry count on successful retrieval
                retry_count = 0
                time.sleep(1)
                
            except Exception as e:
                error_str = str(e)
                # Check if it's a rate limit error
                if "rate_limit" in error_str.lower() or "429" in error_str:
                    wait_time = self._extract_wait_time_from_error(error_str)
                    
                    if retry_count < max_retries:
                        print(f"[DEBUG] Rate limit hit, waiting {wait_time:.1f} seconds (retry {retry_count + 1}/{max_retries})")
                        time.sleep(wait_time)
                        retry_count += 1
                        continue  # Retry
                    else:
                        return {
                            "status": "rate_limited",
                            "error": {"message": error_str, "wait_time": wait_time}
                        }
                # For other errors, continue waiting
                print(f"[DEBUG] Error retrieving run: {e}")
                time.sleep(1)
        
        return {"status": "timeout"}
    
    def _extract_wait_time_from_error(self, error_str: str) -> float:
        """Extract wait time from rate limit error message"""
        import re
        # Look for "try again in X.Xs" pattern
        wait_match = re.search(r'try again in ([\d.]+)s?', error_str.lower())
        if wait_match:
            return float(wait_match.group(1)) + 1  # Add 1 second buffer
        return 5  # Default wait time
    
    def get_messages(self, thread_id: str) -> List[Dict]:
        """
        Get all messages from a thread
        
        Args:
            thread_id: The thread ID
            
        Returns:
            List of messages with role, content, and file_ids
        """
        messages = self.client.beta.threads.messages.list(thread_id=thread_id)
        
        result = []
        for msg in messages.data:
            content = ""
            file_ids = []
            for content_item in msg.content:
                if content_item.type == "text":
                    content = content_item.text.value
                elif content_item.type == "file":
                    file_ids.append(content_item.file_id)
            result.append({
                "role": msg.role,
                "content": content,
                "file_ids": file_ids
            })
        
        return result
    
    def get_latest_assistant_message(self, thread_id: str) -> Optional[str]:
        """
        Get the latest assistant message from the thread
        
        Args:
            thread_id: The thread ID
            
        Returns:
            The latest assistant message or None
        """
        messages = self.get_messages(thread_id)
        
        for msg in messages:
            if msg["role"] == "assistant":
                return msg["content"]
        
        return None
    
    def extract_replacement_mapping(self, thread_id: str) -> Optional[Dict]:
        """
        Extract replacement mapping from assistant's responses
        Also tries to extract from conversation history if JSON not found
        
        Args:
            thread_id: The thread ID
            
        Returns:
            Dict with placeholders and replacements, or None if not found
        """
        # Get all messages and check all assistant messages for JSON
        messages = self.get_messages(thread_id)
        
        print(f"[DEBUG] Extracting replacement mapping from {len(messages)} messages")
        
        # Check messages in reverse order (most recent first)
        for msg in reversed(messages):
            if msg["role"] != "assistant":
                continue
                
            message_content = msg["content"]
            if not message_content:
                continue
            
            print(f"[DEBUG] Checking message: {message_content[:200]}...")
            
            # Try to extract JSON from this message
            try:
                # Remove markdown code blocks if present
                cleaned = self._clean_json_response(message_content)
                result = json.loads(cleaned)
                
                # Validate structure
                if "replacements" in result:
                    print(f"[DEBUG] Found replacements in JSON: {list(result.get('replacements', {}).keys())}")
                    return result
            except Exception as e:
                print(f"[DEBUG] JSON parsing failed: {str(e)}")
                pass
            
            # Try to extract JSON using regex - find everything between first { and last }
            start_idx = message_content.find('{')
            end_idx = message_content.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_match_text = message_content[start_idx:end_idx + 1]
                try:
                    cleaned = self._clean_json_response(json_match_text)
                    result = json.loads(cleaned)
                    if "replacements" in result:
                        print(f"[DEBUG] Found replacements in extracted JSON: {list(result.get('replacements', {}).keys())}")
                        return result
                except Exception as e:
                    print(f"[DEBUG] Extracted JSON parsing failed: {str(e)}")
                    pass
        
        # If JSON not found, try to extract from conversation history
        print("[DEBUG] No JSON found, attempting to extract from conversation history...")
        return self._extract_from_conversation(messages)
    
    def _extract_from_conversation(self, messages: List[Dict]) -> Optional[Dict]:
        """
        Extract replacements from conversation history by matching user answers to placeholders
        
        Args:
            messages: List of all messages
            
        Returns:
            Dict with placeholders and replacements, or None if not found
        """
        # Build conversation pairs (user question, assistant answer)
        conversation_pairs = []
        i = 0
        while i < len(messages):
            if messages[i]["role"] == "assistant" and i + 1 < len(messages):
                if messages[i + 1]["role"] == "user":
                    conversation_pairs.append({
                        "question": messages[i]["content"],
                        "answer": messages[i + 1]["content"]
                    })
            i += 1
        
        # Try to extract placeholder names from assistant messages
        placeholder_patterns = []
        for msg in messages:
            if msg["role"] == "assistant":
                content = msg["content"].lower()
                # Look for mentions of placeholders
                # Pattern: [PLACEHOLDER_NAME] or {{PLACEHOLDER_NAME}}
                patterns = re.findall(r'\[([A-Z_]+)\]|{{([A-Z_]+)}}|\(([A-Z_]+)\)', content)
                for p in patterns:
                    placeholder_name = p[0] or p[1] or p[2]
                    if placeholder_name:
                        placeholder_patterns.append(placeholder_name.upper())
        
        # Map answers to placeholders (this is a simplified approach)
        # In a real scenario, we'd need GPT to help map these
        if conversation_pairs:
            print(f"[DEBUG] Found {len(conversation_pairs)} conversation pairs")
            print(f"[DEBUG] Found placeholder patterns: {set(placeholder_patterns)}")
        
        # Return None if we can't reliably extract
        return None
    
    def _clean_json_response(self, response: str) -> str:
        """Remove markdown code blocks from JSON response"""
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        return response.strip()
    
    def cleanup(self, file_id: Optional[str] = None, assistant_id: Optional[str] = None):
        """
        Clean up OpenAI resources
        
        Args:
            file_id: Optional file ID to delete
            assistant_id: Optional assistant ID to delete
        """
        try:
            if file_id:
                self.client.files.delete(file_id)
            if assistant_id:
                self.client.beta.assistants.delete(assistant_id)
        except Exception as e:
            print(f"Error cleaning up resources: {e}")
