/**
 * JSON Schema to BAML Type Converter
 *
 * Converts JSON Schema definitions to BAML class definitions
 * for use with BAML's dynamic type system (@@dynamic)
 *
 * Supports OpenAI Structured Outputs compatible subset:
 * - type, properties, items, required, description, enum
 * - Nested objects are converted to nested BAML classes
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

interface ConversionContext {
  generatedClasses: Map<string, string>;
  classCounter: number;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateClassName(fieldName: string, parentName: string): string {
  return `${parentName}${capitalize(fieldName)}`;
}

function jsonTypeToBaml(
  schema: JSONSchema,
  isRequired: boolean,
  fieldName: string,
  parentClassName: string,
  ctx: ConversionContext
): string {
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
        const itemType = jsonTypeToBaml(schema.items, true, `${fieldName}Item`, parentClassName, ctx);
        return `${itemType}[]${nullSuffix}`;
      }
      return `string[]${nullSuffix}`;
    case 'object':
      if (schema.properties) {
        const nestedClassName = generateClassName(fieldName, parentClassName);
        generateClass(nestedClassName, schema, ctx);
        return `${nestedClassName}${nullSuffix}`;
      }
      return `map<string, string>${nullSuffix}`;
    default:
      if (schema.properties) {
        const nestedClassName = generateClassName(fieldName, parentClassName);
        generateClass(nestedClassName, schema, ctx);
        return `${nestedClassName}${nullSuffix}`;
      }
      return `string${nullSuffix}`;
  }
}

function generateClass(className: string, schema: JSONSchema, ctx: ConversionContext): void {
  if (ctx.generatedClasses.has(className)) return;

  const requiredFields = new Set(schema.required || []);
  const lines: string[] = [`class ${className} {`];

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties || {})) {
    const isRequired = requiredFields.has(fieldName);
    const bamlType = jsonTypeToBaml(fieldSchema, isRequired, fieldName, className, ctx);

    let fieldDef = `  ${fieldName} ${bamlType}`;

    if (fieldSchema.description) {
      const escapedDesc = fieldSchema.description.replace(/"/g, '\\"');
      fieldDef += ` @description("${escapedDesc}")`;
    }

    lines.push(fieldDef);
  }

  lines.push('}');
  ctx.generatedClasses.set(className, lines.join('\n'));
}

/**
 * Convert JSON Schema to BAML class definitions
 *
 * @param schema - JSON Schema object
 * @param className - Name for the root BAML class (default: 'ExtractedData')
 * @returns BAML class definitions string (may include multiple classes for nested objects)
 *
 * @example
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     address: {
 *       type: 'object',
 *       properties: {
 *         city: { type: 'string' },
 *         zip: { type: 'string' }
 *       }
 *     }
 *   }
 * };
 *
 * jsonSchemaToBAML(schema, 'User');
 * // Returns:
 * // class UserAddress {
 * //   city string | null
 * //   zip string | null
 * // }
 * //
 * // class User {
 * //   name string | null
 * //   address UserAddress | null
 * // }
 * //
 * // dynamic class Response {
 * //   data User
 * // }
 */
export function jsonSchemaToBAML(schema: JSONSchema, className = 'ExtractedData'): string {
  if (schema.type !== 'object' || !schema.properties) {
    throw new Error('Schema must be an object type with properties');
  }

  const ctx: ConversionContext = {
    generatedClasses: new Map(),
    classCounter: 0,
  };

  generateClass(className, schema, ctx);

  const parts: string[] = [];

  // Add nested classes first (in reverse order so dependencies come before dependents)
  const classNames = Array.from(ctx.generatedClasses.keys());
  for (const name of classNames.reverse()) {
    parts.push(ctx.generatedClasses.get(name)!);
  }

  parts.push('');
  parts.push('dynamic class Response {');
  parts.push(`  data ${className}`);
  parts.push('}');

  return parts.join('\n');
}
