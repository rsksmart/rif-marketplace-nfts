const fs = require('fs');
const addresses = require('./addresses');
const simplePlacementsV1Build = require('./build/contracts/ERC721SimplePlacementsV1');

const simplePlacementsV1BuildData = {
    abi: simplePlacementsV1Build.abi,
    bytecode: simplePlacementsV1Build.bytecode,
    address: {
      rskMainnet: addresses.ERC721SimplePlacementsV1.rskMainnet,
      rskTestnet: addresses.ERC721SimplePlacementsV1.rskTestnet,
    },
  };

fs.writeFileSync('./ERC721SimplePlacementsV1Data.json', JSON.stringify(simplePlacementsV1BuildData));

const rnsSimplePlacementsV1Build = require('./build/contracts/RNSSimplePlacementsV1');

const rnsSimplePlacementsV1BuildData = {
    abi: rnsSimplePlacementsV1Build.abi,
    bytecode: rnsSimplePlacementsV1Build.bytecode,
    address: {
      rskMainnet: addresses.RNSSimplePlacementsV1.rskMainnet,
      rskTestnet: addresses.RNSSimplePlacementsV1.rskTestnet,
    },
  };

fs.writeFileSync('./RNSSimplePlacementsV1Data.json', JSON.stringify(rnsSimplePlacementsV1BuildData));

const proxyAdminBuild = require('./build/contracts/ProxyAdmin');

const proxyAdminBuildData = {
  abi: proxyAdminBuild.abi,
  bytecode: proxyAdminBuild.bytecode,
  address: {
    rskMainnet: addresses.ProxyFactory.rskMainnet,
    rskTestnet: addresses.ProxyFactory.rskTestnet,
  },
};

fs.writeFileSync('./ProxyAdminData.json', JSON.stringify(proxyAdminBuildData));

const proxyFactoryBuild = require('./build/contracts/ProxyFactory');

const proxyFactoryBuildData = {
  abi: proxyFactoryBuild.abi,
  bytecode: proxyFactoryBuild.bytecode,
  address: {
    rskMainnet: addresses.ProxyAdmin.rskMainnet,
    rskTestnet: addresses.ProxyAdmin.rskTestnet,
  },
};

fs.writeFileSync('./ProxyFactoryData.json', JSON.stringify(proxyFactoryBuildData));
