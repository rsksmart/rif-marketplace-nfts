const ERC721SimplePlacementsV1 = artifacts.require('ERC721SimplePlacementsV1');
const ERC721Mintable = artifacts.require('ERC721Mintable');

const { encodeCall } = require('@openzeppelin/upgrades');

const { shouldBehaveLikeSimplePlacement } = require('./behavior/simplePlacement.behavior');

contract('ERC721SimplePlacementsV1', (accounts) => {
  const getDefaultToken = () => web3.utils.sha3('DEFAULT_TOKEN');

  const getNotPlaced = () => web3.utils.sha3('NOT_PLACED');

  const setupToken = async (defaultToken) => {
    this.token = await ERC721Mintable.new();
    await this.token.mint(accounts[0], defaultToken);
    return this.token;
  };

  const setupNotPlaced = async (notPlaced) => {
    await this.token.mint(accounts[0], notPlaced);
    return this.token;
  };

  const getInitializeEncodedCall = (token) => encodeCall('initialize', ['address', 'address'], [token.address, accounts[0]]);

  const afterChecks = async () => true;

  shouldBehaveLikeSimplePlacement(
    ERC721SimplePlacementsV1,
    getDefaultToken,
    setupToken,
    getInitializeEncodedCall,
    afterChecks,
    getNotPlaced,
    setupNotPlaced,
    accounts,
  );
});
