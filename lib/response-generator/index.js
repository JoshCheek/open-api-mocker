'use strict';

const logger = require('lllog')();
const faker = require('faker');

const { locale } = Intl.DateTimeFormat().resolvedOptions();
faker.setLocale(locale.replace('-', '_'));

class ResponseGenerator {
	static generate(schema, preferredExampleName, path) {
		const fakerExtension = schema['x-faker'];
		if(fakerExtension) {
			try { return this.generateByFaker(fakerExtension, path); } catch(e) {
				logger.warn(`Failed to generate fake result using ${fakerExtension} schema. Falling back to primitive type.`);
			}
		}


		if(schema.example || schema.examples)
			return this.getBestExample(schema, preferredExampleName);

		if(schema.enum)
			return this.generateByEnum(schema.enum);

		if(schema.allOf)
			return this.generateByAllOf(schema.allOf, path);

		if(schema.oneOf || schema.anyOf)
			return this.generate((schema.oneOf || schema.anyOf)[0], null, path);

		if(schema.type)
			return this.generateByType(schema, path);

		if(schema.schema)
			return this.generate(schema.schema, preferredExampleName, path);

		throw new Error('Could not figure out what to do, yo');
	}

	static generateByAllOf(allOf, path) {
		return allOf
			.map(oneSchema => this.generate(oneSchema, null, path))
			.reduce((acum, oneSchemaValues) => ({ ...acum, ...oneSchemaValues }), {});
	}

	static getBestExample(schemaResponse, preferredExampleName) {
		if(preferredExampleName && schemaResponse.examples[preferredExampleName] && schemaResponse.examples[preferredExampleName].value)
			return schemaResponse.examples[preferredExampleName].value;

		if(schemaResponse.example)
			return schemaResponse.example;

		const { examples } = schemaResponse;
		if(Array.isArray(examples))
			return examples[0];

		const example = Object.values(examples)[0];
		if(example.value !== undefined)
			return example.value;

		throw new Error('Could not find an example');
	}

	static generateByEnum(enumOptions) {
		return enumOptions[0];
	}

	static generateByType(schemaResponse, path) {
		switch(schemaResponse.type) {
			case 'array':
				return this.generateArray(schemaResponse);

			case 'object':
				return this.generateObject(schemaResponse, path);

			case 'string':
				return this.generateString(schemaResponse);

			case 'number':
				return this.generateNumber(schemaResponse);

			case 'integer':
				return this.generateInteger(schemaResponse);

			case 'boolean':
				return this.generateBoolean(schemaResponse);

			default:
				throw new Error('Could not generate response: unknown type');
		}
	}

	/* eslint-disable no-unused-vars */
	static generateByFaker(fakerString, path) {
		// Check if faker string is a template string
		if(fakerString.match(/\{\{.+\}\}/))
			return faker.fake(fakerString);

		const fakerRegex = /^(?<namespace>\w+)\.(?<method>\w+)(?:\((?<argsString>.*)\))?$/.exec(
			fakerString
		);

		if(!fakerRegex)
			throw new Error('Faker extension method is not in the right format. Expecting <namespace>.<method> or <namespace>.<method>(<json-args>) format.');

		const { namespace, method, argsString } = fakerRegex.groups;

		if(!faker[namespace] || !faker[namespace][method])
			throw new Error(`Faker method '${namespace}.${method}' not found`);

		const args = argsString ? JSON.parse(`[${argsString}]`) : [];

		return faker[namespace][method](...args);
	}

	static generateArray(schema, path) {
		let count = Number(schema['x-count']);
		if(Number.isNaN(count) || count < 1)
			count = 1;

		return [...new Array(count)].map(() => this.generate(schema.items, null, path));
	}

	static generateObject(schema, path) {
		const properties = schema.properties || {};
		return Object.entries(properties)
			.map(([property, propertySchema]) => ([property, this.generate(propertySchema, null, path)]))
			.reduce((acum, [property, value]) => ({
				...acum,
				[property]: value
			}), {});
	}

	static generateString() {
		return 'string';
	}

	static generateNumber() {
		return 1;
	}

	static generateInteger() {
		return 1;
	}

	static generateBoolean() {
		return true;
	}

}

module.exports = ResponseGenerator;
