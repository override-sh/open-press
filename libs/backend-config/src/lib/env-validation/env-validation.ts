import { resolve } from "path";
import { readdirSync } from "fs";
import * as Joi from "joi";
import { Hookable, tap } from "@override/utility/server";
import { EnvValidationHooksCallback } from "./types";
import { ENV_VALIDATION_HOOK } from "./constants";

/**
 * @description This class is responsible for validating the environment variables.
 */
export class EnvValidation
	extends Hookable<EnvValidationHooksCallback> {
	private static _instance: EnvValidation;
	private config_file_filters: RegExp[] = [];
	private resolution_paths: string[] = [];

	private constructor() {
		super();
		this.addConfigFileFilters([
			/\.config\.(ts|js)$/,
		]);

		this.addResolutionPaths([
			__dirname,
			resolve(__dirname, ".."),
		]);
	}

	/**
	 * @description This is the singleton instance of the EnvValidation class.
	 * @returns {EnvValidation} The singleton instance of the EnvValidation class.
	 */
	public static get instance(): EnvValidation {
		if (!EnvValidation._instance) {
			EnvValidation._instance = new EnvValidation();
		}

		return EnvValidation._instance;
	}

	public get configFileFilters(): RegExp[] {
		return this.config_file_filters;
	}

	public get resolutionPaths(): string[] {
		return this.resolution_paths;
	}

	/**
	 * @description Add a resolution path to the list of path loading validation schemas.
	 * @param {string} path The path to add.
	 * @returns {EnvValidation} The EnvValidation instance.
	 */
	public addResolutionPath(path: string): EnvValidation {
		this.resolution_paths.push(path);
		return this;
	}

	/**
	 * @description Add a resolution path to the list of path loading validation schemas.
	 * @param {string[]} paths The paths to add.
	 * @returns {EnvValidation} The EnvValidation instance.
	 */
	public addResolutionPaths(paths: string[]): EnvValidation {
		paths.forEach(path => this.addResolutionPath(path));
		return this;
	}

	/**
	 * @description Remove a resolution path from the list of path loading validation schemas.
	 * @param {string} path The path to remove.
	 * @returns {EnvValidation} The EnvValidation instance.
	 */
	public removeResolutionPath(path: string): EnvValidation {
		this.resolution_paths = this.resolution_paths.filter(p => p !== path);
		return this;
	}

	public clearResolutionPaths(): EnvValidation {
		this.resolution_paths = [];
		return this;
	}

	/**
	 * @description This function will add a config file filter.
	 * @param {RegExp} filter The filter to add.
	 * @returns {EnvValidation} The EnvValidation instance.
	 */
	public addConfigFileFilter(filter: RegExp): EnvValidation {
		this.config_file_filters.push(filter);
		return this;
	}

	/**
	 * @description This function will add a config file filter.
	 * @param filters The filters to add.
	 * @returns {EnvValidation} The EnvValidation instance.
	 */
	public addConfigFileFilters(filters: RegExp[]): EnvValidation {
		filters.forEach(filter => this.addConfigFileFilter(filter));
		return this;
	}

	/**
	 * @description This function will remove a config file filter.
	 * @param {RegExp} filter The filter to remove.
	 * @returns {EnvValidation} The EnvValidation instance.
	 */
	public removeConfigFileFilter(filter: RegExp): EnvValidation {
		this.config_file_filters = this.config_file_filters.filter(f => f.source !== filter.source);
		return this;
	}

	/**
	 * @description This function will clear all config file filters.
	 * @returns {EnvValidation} The EnvValidation instance.
	 */
	public clearConfigFileFilters(): EnvValidation {
		this.config_file_filters = [];
		return this;
	}

	/**
	 * @description This function will validate the environment variables against the list of validation schema
	 *     provided in each configuration file.
	 * @param {Record<string, unknown>} config
	 * @returns {Record<string, unknown>}
	 */
	public validateEnv(config: Record<string, any>): Record<string, unknown> {
		this.trigger(ENV_VALIDATION_HOOK.validate_before, { config });

		this.resolveConfigValidationSchema()
		    .forEach(schema => {
			    // validate the config object against the validation schema
			    const { error } = schema.validate(config, { allowUnknown: true });

			    this.trigger(
				    ENV_VALIDATION_HOOK.validate_schema,
				    {
					    schema,
					    config,
					    error,
				    },
			    );

			    // if an error was found, re-throw it
			    if (error) {
				    throw new Error(`Config validation error: ${error.message}`);
			    }
		    });

		this.trigger(ENV_VALIDATION_HOOK.validate_after, { config });

		// return the validated config object if no error was found
		return config;
	}

	/**
	 * @description This function will resolve the validation schema from each configuration file.
	 * @example
	 * export const validationSchema = Joi.object({
	 * 	DB_HOST:     Joi.string().min(1, "utf8").required(),
	 * 	DB_PORT:     Joi.number().min(1024).max(65535).required(),
	 * 	DB_USERNAME: Joi.string().min(1, "utf8").required(),
	 * 	DB_PASSWORD: Joi.string().min(1, "utf8").required(),
	 * 	DB_DATABASE: Joi.string().min(1, "utf8").required(),
	 * });
	 * @returns {Joi.ObjectSchema[]} The list of validation schemas.
	 */
	private resolveConfigValidationSchema(): Joi.ObjectSchema[] {
		return this.resolution_paths
		           .map(path => {
			           const cwd = resolve(path);
			           const config_files = readdirSync(cwd)
				           .filter(value => this.passesConfigFileFilters(value));

			           this.trigger(ENV_VALIDATION_HOOK.configuration_resolved_files, { files: config_files });

			           return tap(
				           config_files.map(file => require(resolve(cwd, file)))
				                       .map(config => config.validationSchema || null)
				                       .filter(schema => schema !== null) as Joi.ObjectSchema[],
				           schemas => {
					           this.trigger(ENV_VALIDATION_HOOK.configuration_loaded_schemas, { schemas });
				           },
			           );
		           })
		           .flat();
	}

	/**
	 * @description This function will check if the file passes the config file filters.
	 * @param {string} file The file to check.
	 * @returns {boolean} True if the file passes the config file filters, false otherwise.
	 * @private
	 */
	private passesConfigFileFilters(file: string): boolean {
		return this.config_file_filters.some(filter => filter.test(file));
	}
}
