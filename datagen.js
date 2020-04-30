const fs = require('fs');
const simplePlacementsBuild = require('./build/contracts/ERC721SimplePlacements');

fs.writeFileSync('./ERC721SimplePlacementsABI.json', JSON.stringify(simplePlacementsBuild.abi));
fs.writeFileSync('./ERC721SimplePlacementsBytecode.json', JSON.stringify(simplePlacementsBuild.bytecode));
