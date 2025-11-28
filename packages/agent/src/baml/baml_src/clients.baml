// BAML Client Configuration
//
// NOTE: We only use this for b.request to render prompts with ctx.output_format()
// The actual LLM call is made via Vercel AI SDK, not BAML's HTTP client.
// These are dummy configs - credentials are not used at runtime.

retry_policy Exponential {
  max_retries 2
  strategy {
    type exponential_backoff
    delay_ms 300
    multiplier 2
  }
}

// Dummy OpenAI client - used only for prompt rendering via b.request
client<llm> OpenAI {
  provider openai
  retry_policy Exponential
  options {
    model env.BAML_OPENAI_MODEL
    api_key env.BAML_OPENAI_API_KEY
  }
}
