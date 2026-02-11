const findFirstOccurrence = (string, searchElements, fromIndex = 0) => {
  let min = string.length;
  for (let i = 0; i < searchElements.length; i += 1) {
    const occ = string.indexOf(searchElements[i], fromIndex);
    if (occ !== -1 && occ < min) {
      min = occ;
    }
  }
  return min === string.length ? -1 : min;
};

const functionname = (func?: any) => {
  if (func) {
    if (func.name) {
      return func.name;
    }
    const result = /^function\s+([\w\$]+)\s*\(/.exec(func.toString());
    return result ? result[1] : '';
  }

  let obj = { stack: '' };
  //Error.stackTraceLimit=40
  Error.captureStackTrace(obj, functionname);
  const { stack } = obj;
  // console.log(stack.split('\n'));

  let stacks = stack.split('\n').reverse();

  let functionNames = {};
  for (let index = 1; index < stacks.length; index++) {
    let splitstack = stacks[index];
    const firstCharacter = splitstack.indexOf('at ') + 3;
    let lastCharacter = findFirstOccurrence(splitstack, [' ', ':'], firstCharacter);
    const _line = splitstack.split(':')[splitstack.split(':').length - 2];
    let fname: string = splitstack.slice(firstCharacter, lastCharacter);
    if (
      fname.includes('.') &&
      ![
        'MyLogger.log',
        'Logger.log',
        'Logger.descriptor.value',
        'descriptor.value',
        'Logger.error',
        'MyLogger.error',
      ].includes(fname)
    )
      functionNames[fname] = _line;
  }
  return functionNames;
};

const errorException = (stack: any) => {
  if (!stack) return undefined;
  let functionNames = {};
  let stacks = stack.split('\n').reverse();
  for (let index = 1; index < stacks.length; index++) {
    let splitstack = stacks[index];
    const firstCharacter = splitstack.indexOf('at ') + 3;
    let lastCharacter = findFirstOccurrence(splitstack, [' ', ':'], firstCharacter);
    const _line = splitstack.split(':')[splitstack.split(':').length - 2];
    let fname: string = splitstack.slice(firstCharacter, lastCharacter);
    if (
      fname.includes('.') &&
      ![
        'MyLogger.log',
        'Logger.log',
        'Logger.descriptor.value',
        'descriptor.value',
        'Logger.error',
        'MyLogger.error',
      ].includes(fname)
    )
      functionNames[fname] = _line;
  }

  return { functionNames, path: stacks.reverse() };
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { functionname, errorException, sleep };
