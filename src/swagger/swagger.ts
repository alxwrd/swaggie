import YAML from 'js-yaml';
import httpClient from 'got';

export interface SpecOptions {
  /**
   * A base ref string to ignore when expanding ref dependencies e.g. '#/definitions/'
   */
  ignoreRefType?: string;
}

export function resolveSpec(src: string | object, options?: SpecOptions): Promise<ApiSpec> {
  if (!options) {
    options = {};
  }

  if (typeof src === 'string') {
    return loadFile(src).then((spec) => formatSpec(spec, src, options));
  } else {
    return Promise.resolve(formatSpec(src as ApiSpec, null, options));
  }
}

function loadFile(src: string): Promise<ApiSpec | any> {
  if (/^https?:\/\//im.test(src)) {
    return loadFromUrl(src);
  } else if (String(process) === '[object process]') {
    return readLocalFile(src).then((contents) => parseFileContents(contents, src));
  } else {
    throw new Error(`Unable to load api at '${src}'`);
  }
}

function loadFromUrl(url: string) {
  return httpClient(url)
    .then((resp) => resp.body)
    .then((contents) => parseFileContents(contents, url));
}

function readLocalFile(filePath: string): Promise<string> {
  return new Promise((res, rej) =>
    require('fs').readFile(filePath, 'utf8', (err, contents) => (err ? rej(err) : res(contents))),
  );
}

function parseFileContents(contents: string, path: string): object {
  return /.ya?ml$/i.test(path) ? YAML.safeLoad(contents) : JSON.parse(contents);
}

function formatSpec(spec: ApiSpec, src?: string, options?: SpecOptions): ApiSpec {
  return expandRefs(spec, spec, options) as ApiSpec;
}

/**
 * Recursively expand internal references in the form `#/path/to/object`.
 *
 * @param {object} data the object to search for and update refs
 * @param {object} lookup the object to clone refs from
 * @param {regexp=} refMatch an optional regex to match specific refs to resolve
 * @returns {object} the resolved data object
 */
export function expandRefs(data: any, lookup: object, options: SpecOptions): any {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => expandRefs(item, lookup, options));
  } else if (typeof data === 'object') {
    if (dataCache.has(data)) {
      return data;
    }
    if (data.$ref && !(options.ignoreRefType && data.$ref.startsWith(options.ignoreRefType))) {
      const resolved = expandRef(data.$ref, lookup);
      delete data.$ref;
      data = Object.assign({}, resolved, data);
    }
    dataCache.add(data);

    // tslint:disable-next-line:forin prefer-const
    for (let name in data) {
      data[name] = expandRefs(data[name], lookup, options);
    }
  }
  return data;
}

function expandRef(ref: string, lookup: object): any {
  const parts = ref.split('/');
  if (parts.shift() !== '#' || !parts[0]) {
    throw new Error(`Only support JSON Schema $refs in format '#/path/to/ref'`);
  }
  let value = lookup;
  while (parts.length) {
    value = value[parts.shift()];
    if (!value) {
      throw new Error(`Invalid schema reference: ${ref}`);
    }
  }
  return value;
}

const dataCache = new Set();
