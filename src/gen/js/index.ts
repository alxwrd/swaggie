import genOperations from './genOperations';
import genTypes from './genTypes';
import { saveFile, prepareOutputFilename } from '../util';

export default function genCode(
  spec: any,
  operations: ApiOperation[],
  options: ClientOptions
): Schema {
  let [fileContents, queryDefinitions] = genOperations(spec, operations, options);
  fileContents += genTypes(spec, queryDefinitions, options);

  const destFile = prepareOutputFilename(options.out);
  saveFile(destFile, fileContents);
  return spec;
}
