// request-promise-core receives its transport via configure({ request }).
// The Cypress fork supplies @cypress/request; its inherited legacy peer is unused.
// Removing that obsolete peer prevents pnpm from installing abandoned request@2.
module.exports = { hooks: { readPackage(pkg) {
  if (pkg.name === 'request-promise-core' && pkg.version === '1.1.3' && pkg.peerDependencies) {
    delete pkg.peerDependencies.request;
  }
  return pkg;
} } };
