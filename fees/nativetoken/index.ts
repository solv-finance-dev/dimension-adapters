import { BreakdownAdapter, FetchOptions } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import * as sdk from "@defillama/sdk";
import BigNumber from "bignumber.js";

async function myfetch(option: FetchOptions) {
  const fromBlockHeight = await option.getFromBlock();
  const toBlockHeight = await option.getToBlock();
  const reward = await getNativeTokenDepositAmount(
    "0x37cccf9c128a9196c4e6eab4ac9b166da58d8c77",
    fromBlockHeight,
    toBlockHeight,
    option.chain
  );

  //   const decimalRemainder = BigNumber(10).pow(18);
  return {
    dailyRevenue: reward.toString(10),
  };
}
const adapter: BreakdownAdapter = {
  version: 2,
  breakdown: {
    v2: {
      [CHAIN.ETHEREUM]: {
        fetch: myfetch,
        start: 1702857600,
      },
    },
  },
};

interface IBalanceChange {
  block: number;
  amount: BigNumber;
}
async function getNativeTokenDepositAmount(
  targetAddress: string,
  fromBlock: number,
  toBlock: number,
  chain: string
): Promise<BigNumber> {
  const balanceChanges = await foundNativeTokenTransfer(
    targetAddress,
    fromBlock,
    toBlock,
    chain
  );
  let balance = BigNumber(0);
  for (const balChangeInfo of balanceChanges) {
    if (balChangeInfo.amount.isPositive()) {
      balance = balance.plus(balChangeInfo.amount);
    }
  }
  return balance;
}

async function foundNativeTokenTransfer(
  targetAddress: string,
  fromBlock: number,
  toBlock: number,
  chain: string
): Promise<IBalanceChange[]> {
  const logPrefix = `${fromBlock}_${toBlock}`;

  if (fromBlock > toBlock) {
    throw new Error(`${fromBlock} greater than ${toBlock}`);
  }

  if (fromBlock === toBlock) {
    const [preAmount, afterAmount] = await Promise.all([
      getBalance(targetAddress, fromBlock - 1, chain),
      getBalance(targetAddress, fromBlock, chain),
    ]);
    if (preAmount.isEqualTo(afterAmount)) {
      return [];
    } else {
      return [{ block: fromBlock, amount: afterAmount.minus(preAmount) }];
    }
  }
  const [fromAmount, toAmount] = await Promise.all([
    getBalance(targetAddress, fromBlock - 1, chain),
    getBalance(targetAddress, toBlock, chain),
  ]);
  if (!toAmount.isEqualTo(fromAmount)) {
    const middleBlock = Math.floor((fromBlock + toBlock) / 2);
    const leftResults = await foundNativeTokenTransfer(
      targetAddress,
      fromBlock,
      middleBlock,
      chain
    );
    const rightResults = await foundNativeTokenTransfer(
      targetAddress,
      middleBlock + 1,
      toBlock,
      chain
    );

    return [leftResults, rightResults].flat();
  } else {
    return [];
  }
}

async function getBalance(
  address: string,
  block: number,
  chain: string
): Promise<BigNumber> {
  let retryCount = 0;
  while (retryCount < 3) {
    try {
      const provider = sdk.getProvider(chain, true);
      const amount = (await provider.getBalance(
        address,
        block
      )) as any as string;
      return BigNumber(amount, 10);
    } catch (err) {
      retryCount++;
      console.log(block, err);
    }
  }
  throw new Error(`retry max ${block}`);
}
export default adapter;
