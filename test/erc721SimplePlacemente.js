const BytesLib = artifacts.require('BytesLib');
const ERC721Mintable = artifacts.require('ERC721Mintable');
const ERC677 = artifacts.require('ERC677');
const ERC721SimplePlacements = artifacts.require('ERC721SimplePlacements');

const { expect } = require('chai');
const { expectRevert, expectEvent, constants } = require('@openzeppelin/test-helpers');

contract('ERC721 Simple Placements', (accounts) => {
  const defaultToken = web3.utils.sha3('DEFAULT_TOKEN');

  beforeEach(async () => {
    this.token = await ERC721Mintable.new();
    await this.token.mint(accounts[0], defaultToken);

    this.billToken = await ERC677.new(
      accounts[1],
      web3.utils.toBN('1000000000000000000000'),
      'RIF',
      'RIF',
      web3.utils.toBN('18'),
    );

    const bytesLib = await BytesLib.new();
    await ERC721SimplePlacements.link('BytesLib', bytesLib.address);

    this.simplePlacements = await ERC721SimplePlacements.new(this.billToken.address, this.token.address);
  });

  describe('placing', async () => {
    it('should revert when there is no placement for a token', async () => {
      const notPlaced = web3.utils.sha3('NOT_PLACED');

      await expectRevert(
        this.simplePlacements.placement(notPlaced),
        'Token not placed.',
      );
    });

    it('should not allow to place not approved token', async () => {
      const cost = web3.utils.toBN('1000000000000000000');

      await expectRevert(
        this.simplePlacements.place(defaultToken, cost),
        'Not approved to transfer.',
      );

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should not allow not owner or controller to place token', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      const cost = web3.utils.toBN('1000000000000000000');

      await expectRevert(
        this.simplePlacements.place(defaultToken, cost, { from: accounts[3] }),
        'Not approved or owner.',
      );

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should allow owner to place token', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      const cost = web3.utils.toBN('1000000000000000000');

      await this.simplePlacements.place(defaultToken, cost);

      expect(
        await this.simplePlacements.placement(defaultToken),
      ).to.be.bignumber.equal(
        cost,
      );
    });

    it('should allow controller to place token', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      const cost = web3.utils.toBN('1000000000000000000');

      await this.token.setApprovalForAll(accounts[2], true);

      await this.simplePlacements.place(defaultToken, cost, { from: accounts[2] });

      expect(
        await this.simplePlacements.placement(defaultToken),
      ).to.be.bignumber.equal(
        cost,
      );
    });

    it('should emit UpdatePlacement event', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      const cost = web3.utils.toBN('1000000000000000000');

      await this.token.setApprovalForAll(accounts[2], true);

      const receipt = await this.simplePlacements.place(defaultToken, cost, { from: accounts[2] });

      await expectEvent(
        receipt,
        'UpdatePlacement',
        {
          tokenId: web3.utils.toBN(defaultToken),
          cost,
        },
      );
    });
  });

  describe('unplacing', async () => {
    it('should allow anyone to unplace not approved tokens', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      const cost = web3.utils.toBN('1000000000000000000');

      await this.simplePlacements.place(defaultToken, cost);

      await this.token.approve(constants.ZERO_ADDRESS, defaultToken);

      await this.simplePlacements.unplace(defaultToken);

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should allow anyone to unplace transferred tokens', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      const cost = web3.utils.toBN('1000000000000000000');

      await this.simplePlacements.place(defaultToken, cost);

      await this.token.transferFrom(accounts[0], accounts[2], defaultToken);

      await this.simplePlacements.unplace(defaultToken);

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });
  });

  describe('buying', async () => {
    describe('it should not allow to buy not placed token via', async () => {
      const notPlaced = web3.utils.sha3('NOT_PLACED');

      beforeEach(async () => {
        await this.token.mint(accounts[0], notPlaced);
      });

      it('erc20 approve + transfer', async () => {
        await this.billToken.approve(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

        await expectRevert(
          this.simplePlacements.buy(notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await expectRevert(
          this.billToken.transferAndCall(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });
    });

    describe('should transfer placed token when bills are sent via + emit PlacementUpdated to 0 + remove placement', async () => {
      const cost = web3.utils.toBN('1000000000000000000');

      beforeEach(async () => {
        await this.token.approve(this.simplePlacements.address, defaultToken);

        await this.simplePlacements.place(defaultToken, cost);
      });

      it('erc20 approve + transfer', async () => {
        await this.billToken.approve(this.simplePlacements.address, cost, { from: accounts[1] });

        const receipt = await this.simplePlacements.buy(defaultToken, { from: accounts[1] });

        expect(
          await this.token.ownerOf(defaultToken),
        ).to.be.eq(
          accounts[1],
        );

        await expectEvent(
          receipt,
          'UpdatePlacement',
          {
            tokenId: web3.utils.toBN(defaultToken),
            cost: web3.utils.toBN('0'),
          },
        );

        await expectRevert(
          this.simplePlacements.placement(defaultToken),
          'Token not placed.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await this.billToken.transferAndCall(
          this.simplePlacements.address,
          cost,
          defaultToken,
          { from: accounts[1] },
        );

        expect(
          await this.token.ownerOf(defaultToken),
        ).to.be.eq(
          accounts[1],
        );

        const logs = await this.simplePlacements.getPastEvents('allEvents');

        await expectEvent.inLogs(
          logs,
          'UpdatePlacement',
          {
            tokenId: web3.utils.toBN(defaultToken),
            cost: web3.utils.toBN('0'),
          },
        );

        await expectRevert(
          this.simplePlacements.placement(defaultToken),
          'Token not placed.',
        );
      });
    });

    describe('should not transfer placed token when not enough bills are sent via', async () => {
      beforeEach(async () => {
        await this.token.approve(this.simplePlacements.address, defaultToken);

        await this.simplePlacements.place(defaultToken, web3.utils.toBN('2000000000000000000'));
      });

      it('erc20 approve + transfer', async () => {
        await this.billToken.approve(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

        await expectRevert(
          this.simplePlacements.buy(defaultToken, { from: accounts[1] }),
          'ERC20: transfer amount exceeds allowance -- Reason given: ERC20: transfer amount exceeds allowance.',
        );

        expect(
          await this.token.ownerOf(defaultToken),
        ).to.be.eq(
          accounts[0],
        );
      });

      it('erc677 transferAndCall', async () => {
        await expectRevert(
          this.billToken.transferAndCall(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
          'ERC20: transfer amount exceeds balance -- Reason given: ERC20: transfer amount exceeds balance.',
        );

        expect(
          await this.token.ownerOf(defaultToken),
        ).to.be.eq(
          accounts[0],
        );
      });
    });
  });

  it('should only allow bill to execute tokeFallback', async () => {
    await expectRevert(
      this.simplePlacements.tokenFallback(accounts[1], web3.utils.toBN('1000000000000000000'), defaultToken),
      'Invalid token.',
    );
  });
});
