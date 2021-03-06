import type { Required } from 'utility-types';
import type { Reporter } from 'gatsby';
import type { GraphQLTagPluckOptions } from '@graphql-tools/graphql-tag-pluck';
import type { GatsbyStore } from './gatsby-utils';
import type {
  PluginOptions,
  SchemaOutputOptions,
  DeprecatedPluginOptions,
} from './types';

import path from 'path';
import { formatLanguage } from './common';
import { gatsbyInternalScalars } from './gatsby-utils';

// No parsing by default, save introspection result file as json format.
const DEFAULT_SCHEMA_OUTPUT_OPTION = {
  format: 'introspection',
  commentDescriptions: true,
} as const;

type MapEmitSchemaOption<T> = T extends { [key: string]: infer V }
  ? V extends true
  ? { [key: string]: typeof DEFAULT_SCHEMA_OUTPUT_OPTION }
  : { [key: string]: SchemaOutputOptions }
  : never;

export type RequiredPluginOptions = Required<
  Omit<
    PluginOptions,
    (
      | keyof DeprecatedPluginOptions
      | 'emitSchema'
    )
  > & {
    emitSchema: MapEmitSchemaOption<PluginOptions['emitSchema']>,
  }
>;

interface RequirePluginOptionsFn {
  (
    options: unknown,
    props: {
      reporter: Reporter,
      store: GatsbyStore,
    },
  ): RequiredPluginOptions;
}
export const requirePluginOptions: RequirePluginOptionsFn = (
  options,
  {
    store,
    reporter,
  },
) => {
  const { program } = store.getState();
  const basePath = program.directory;

  // There are no required properties (yet), so must be compatible.
  const pluginOptions = options as PluginOptions;

  const {
    language = 'typescript',
    namespace = 'GatsbyTypes',
    emitSchema: emitSchemaOptionMap = {},
    includeResolvers = false,
    autoFix = true,
    emitPluginDocuments = {},
    schemaOutputPath,
    typeDefsOutputPath,
    scalars = {},
  } = pluginOptions;

  const emitSchema: MapEmitSchemaOption<typeof emitSchemaOptionMap> = {};
  for (const [key, options] of Object.entries(emitSchemaOptionMap)) {
    if (options === true) {
      emitSchema[key] = {
        ...DEFAULT_SCHEMA_OUTPUT_OPTION,
        // Infer format option based on filename.
        format: /\.(gql|graphql)$/.test(key)
          ? 'sdl'
          : 'introspection',
      };
    }
  }

  if (schemaOutputPath) {
    reporter.warn('`schemaOutputPath` was deprecated, please use `emitSchema` instead.');
    emitSchema[schemaOutputPath] = DEFAULT_SCHEMA_OUTPUT_OPTION;
  }

  if (typeDefsOutputPath) {
    reporter.warn('`typeDefsOutputPath` was deprecated, please use `outputPath` instead.');
  }

  const outputPath = pluginOptions.outputPath || typeDefsOutputPath || (
    language === 'typescript'
    ? path.resolve(basePath, 'src/__generated__/gatsby-types.ts')
    : path.resolve(basePath, 'src/__generated__/gatsby-types.js')
  );

  if ((language === 'typescript') !== /\.tsx?$/.test(outputPath)) {
    reporter.warn(
      reporter.stripIndent(
      `The language you specified is not match to file extension.
        - language: ${formatLanguage(language)}
        - outputPath: ${outputPath}
      `),
    );
  }

  for (const type of gatsbyInternalScalars) {
    if (scalars[type]) {
      reporter.warn(
        `[typegen] You couldn't override type for \`${type}\` scalar because it is reserved by Gatsby internal.`,
      );
      delete scalars[type];
    }
  }

  return {
    language,
    namespace,
    outputPath,
    includeResolvers,
    autoFix,
    emitSchema,
    emitPluginDocuments,
    scalars,
  };
};

export const GRAPHQL_TAG_PLUCK_OPTIONS: GraphQLTagPluckOptions = {
  modules: [
    // Allow only GatsbyJS
    {
      name: 'gatsby',
      identifier: 'graphql',
    },
  ],
};
