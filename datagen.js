const fs = require('fs');
const simplePlacementsBuild = require('./build/contracts/ERC721SimplePlacementsV1');

fs.writeFileSync('./ERC721SimplePlacementsABI.json', JSON.stringify(simplePlacementsBuild.abi));
fs.writeFileSync('./ERC721SimplePlacementsBytecode.json', JSON.stringify(simplePlacementsBuild.bytecode));

const proxyAdminBuild = require('./build/contracts/ProxyAdmin');

fs.writeFileSync('./ProxyAdminABI.json', JSON.stringify(proxyAdminBuild.abi));
fs.writeFileSync('./ProxyAdminBytecode.json', JSON.stringify(proxyAdminBuild.bytecode));

const proxyFactoryBuild = require('./build/contracts/ProxyFactory');

fs.writeFileSync('./ProxyFactoryABI.json', JSON.stringify(proxyFactoryBuild.abi));
fs.writeFileSync('./ProxyFactoryBytecode.json', JSON.stringify(proxyFactoryBuild.bytecode));

