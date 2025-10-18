const Module = require('module');
const path = require('path');

const originalResolveFilename = Module._resolveFilename;
const serverOnlyPath = path.join(__dirname, 'server-only-stub.js');

Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
  if (request === 'server-only') {
    return serverOnlyPath;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
