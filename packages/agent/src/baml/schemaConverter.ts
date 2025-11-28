/**
 * JSON Schema to BAML Type Converter
 *
 * Converts JSON Schema definitions to BAML class definitions
 * for use with BAML's dynamic type system (@@dynamic)
 *
 * Supports OpenAI Structured Outputs compatible subset:
 * - type, properties, items, required, description, enum
 * - NO: oneOf, anyOf, allOf, $ref (not supported by OpenAI)
 */

export interface JSONSchema {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  enum?: string[];
  additionalProperties?: boolean;
}

/**
 * Convert a JSON Schema type to BAML type
 */
function jsonTypeToBaml(schema: JSONSchema, isRequired: boolean): string {
  const nullSuffix = isRequired ? '' : ' | null';

  if (schema.enum) {
    const enumValues = schema.enum.map((v) => `"${v}"`);
    return `(${enumValues.join(' | ')})${nullSuffix}`;
  }

  switch (schema.type) {
    case 'string':
      return `string${nullSuffix}`;
    case 'number':
    case 'integer':
      return `float${nullSuffix}`;
    case 'boolean':
      return `bool${nullSuffix}`;
    case 'array':
      if (schema.items) {
        const itemType = jsonTypeToBaml(schema.items, true);
        return `${itemType}[]${nullSuffix}`;
      }
      return `string[]${nullSuffix}`;
    case 'object':
      return `map<string, string>${nullSuffix}`;
    default:
      return `string${nullSuffix}`;
  }
}

/**
 * Convert JSON Schema to BAML class definition
 *
 * @param schema - JSON Schema object
 * @param className - Name for the generated BAML class (default: 'ExtractedData')
 * @returns BAML class definition string
 *
 * @example
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string', description: 'User name' },
 *     age: { type: 'number' }
 *   },
 *   required: ['name']
 * };
 *
 * jsonSchemaToBAML(schema, 'User');
 * // Returns:
 * // class User {
 * //   name string @description("User name")
 * //   age float | null
 * // }
 * //
 * // override Response {
 * //   data User
 * // }
 */
export function jsonSchemaToBAML(schema: JSONSchema, className = 'ExtractedData'): string {
  if (schema.type !== 'object' || !schema.properties) {
    throw new Error('Schema must be an object type with properties');
  }

  const requiredFields = new Set(schema.required || []);
  const lines: string[] = [`class ${className} {`];

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    const isRequired = requiredFields.has(fieldName);
    const bamlType = jsonTypeToBaml(fieldSchema, isRequired);

    let fieldDef = `  ${fieldName} ${bamlType}`;

    if (fieldSchema.description) {
      const escapedDesc = fieldSchema.description.replace(/"/g, '\\"');
      fieldDef += ` @description("${escapedDesc}")`;
    }

    lines.push(fieldDef);
  }

  lines.push('}');
  lines.push('');
  lines.push('dynamic class Response {');
  lines.push(`  data ${className}`);
  lines.push('}');

  return lines.join('\n');
}
