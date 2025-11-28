// BAML Extraction Function
//
// Dynamic extraction using @@dynamic types.
// Schema is injected at runtime via TypeBuilder.addBaml()

// Response type with dynamic data field
// The actual schema is injected at runtime
class Response {
  @@dynamic
}

// Extraction prompt template
// Uses ctx.output_format() to render the schema in a format optimized for LLMs
template_string ExtractionPrompt(query: string, content: string) #"
  You are extracting structured data from an AI assistant's response.

  The user originally asked:
  {{ query }}

  Based on this request, extract the relevant information from the assistant's response below.
  Be precise and only extract what is explicitly present in the content.
  If a field cannot be determined from the content, use null.

  {{ ctx.output_format(prefix="Answer with JSON matching this schema:\n") }}

  {{ _.role('user') }}
  Assistant's response to extract from:
  ---
  {{ content }}
  ---
"#

// Extraction function - uses OpenAI client for prompt rendering
function Extract(query: string, content: string) -> Response {
  client OpenAI
  prompt #"{{ ExtractionPrompt(query, content) }}"#
}
