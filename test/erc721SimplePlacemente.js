const BytesLib = artifacts.require('BytesLib');
const ERC721Mintable = artifacts.require('ERC721Mintable');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const ERC677 = artifacts.require('ERC677');
const ERC721SimplePlacements = artifacts.require('ERC721SimplePlacements');

const { expect } = require('chai');
const { expectRevert, expectEvent, constants } = require('@openzeppelin/test-helpers');

contract('ERC721 Simple Placements', (accounts) => {
  const defaultToken = web3.utils.sha3('DEFAULT_TOKEN');

  beforeEach(async () => {
    this.token = await ERC721Mintable.new();
    await this.token.mint(accounts[0], defaultToken);

    this.rif = await ERC677.new(
      accounts[1],
      web3.utils.toBN('1000000000000000000000'),
      'RIF',
      'RIF',
      web3.utils.toBN('18'),
    );

    const bytesLib = await BytesLib.new();
    await ERC721SimplePlacements.link('BytesLib', bytesLib.address);

    this.simplePlacements = await ERC721SimplePlacements.new(this.rif.address, this.token.address);
  });

  describe('ownership', async () => {
    it('creator should be the owner', async () => {
      const owner = await this.simplePlacements.owner();

      expect(
        owner,
      ).to.eq(
        accounts[0],
      );
    });

    it('should not allow not owner to set new owner', async () => {
      await expectRevert(
        this.simplePlacements.transferOwnership(accounts[1], { from: accounts[1]  }),
        "Ownable: caller is not the owner",
      );
    });

    it('should allow owner to set new owner', async () => {
      await this.simplePlacements.transferOwnership(accounts[1]);

      const owner = await this.simplePlacements.owner();

      expect(
        owner,
      ).to.eq(
        accounts[1],
      );
    });
  });

  describe('whitelisting', async () => {
    it('should not allow not owner to set whitelisted token', async () => {
      const token = await ERC20Mintable.new({ from: accounts[1] });

      await expectRevert(
        this.simplePlacements.setWhitelisted(token.address, true, false, false, { from: accounts[1] }),
        "Ownable: caller is not the owner",
      );
    });

    it('should allow owner to set whitelisted token', async () => {
      await this.simplePlacements.setWhitelisted(this.rif.address, true, true, false);

      const whitelisted = await this.simplePlacements.whitelisted(this.rif.address);

      expect(whitelisted[0]).to.eq(true);
      expect(whitelisted[1]).to.eq(true);
      expect(whitelisted[2]).to.eq(false);
    });

    it('should allow owner to remove whitelisted tokens', async () => {
      await this.simplePlacements.setWhitelisted(this.rif.address, true, true, false);

      await this.simplePlacements.setWhitelisted(this.rif.address, false, false, false);

      const whitelisted = await this.simplePlacements.whitelisted(this.rif.address);

      expect(whitelisted[0]).to.eq(false);
      expect(whitelisted[1]).to.eq(false);
      expect(whitelisted[2]).to.eq(false);
    });

    it('should emit PaymentTokenWhitelisted event', async () => {
      await this.simplePlacements.setWhitelisted(this.rif.address, true, true, false);

      const logs = await this.simplePlacements.getPastEvents('allEvents');

      await expectEvent.inLogs(
        logs,
        'PaymentTokenWhitelistChanged',
        {
          paymentToken: this.rif.address,
          isERC20: true,
          isERC677: true,
          isERC777: false,
        },
      );
    });
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
        await this.rif.approve(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

        await expectRevert(
          this.simplePlacements.buy(notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await expectRevert(
          this.rif.transferAndCall(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });
    });

    describe('should transfer placed token when rif are sent via + emit PlacementUpdated to 0 + remove placement', async () => {
      const cost = web3.utils.toBN('1000000000000000000');

      beforeEach(async () => {
        await this.token.approve(this.simplePlacements.address, defaultToken);

        await this.simplePlacements.place(defaultToken, cost);
      });

      it('erc20 approve + transfer', async () => {
        await this.rif.approve(this.simplePlacements.address, cost, { from: accounts[1] });

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
        await this.rif.transferAndCall(
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

    describe('should not transfer placed token when not enough rif are sent via', async () => {
      beforeEach(async () => {
        await this.token.approve(this.simplePlacements.address, defaultToken);

        await this.simplePlacements.place(defaultToken, web3.utils.toBN('2000000000000000000'));
      });

      it('erc20 approve + transfer', async () => {
        await this.rif.approve(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

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
          this.rif.transferAndCall(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
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

  it('should only allow rif to execute tokeFallback', async () => {
    await expectRevert(
      this.simplePlacements.tokenFallback(accounts[1], web3.utils.toBN('1000000000000000000'), defaultToken),
      'Only RIF token.',
    );
  });
});
