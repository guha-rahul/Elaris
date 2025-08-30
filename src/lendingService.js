export class LendingService {
	constructor() {
		this.markets = new Map(); // key: symbol, value: { totalSupply, totalBorrow, reserves, interestRate }
		this.userBalances = new Map(); // key: user, value: { [symbol]: { supplied, borrowed } }
	}

	ensureMarket(symbol) {
		if (!this.markets.has(symbol)) {
			this.markets.set(symbol, {
				totalSupply: 0n,
				totalBorrow: 0n,
				reserves: 0n,
				interestRate: 500n, // 5% APR in basis points
			});
		}
		return this.markets.get(symbol);
	}

	ensureUser(user) {
		if (!this.userBalances.has(user)) {
			this.userBalances.set(user, {});
		}
		return this.userBalances.get(user);
	}

	getState() {
		const markets = Array.from(this.markets.entries()).map(([symbol, m]) => ({ symbol, ...m }));
		return { markets };
	}

	supply(user, symbol, amount) {
		const amt = BigInt(amount);
		if (amt <= 0) throw new Error('amount must be positive');
		const market = this.ensureMarket(symbol);
		const userState = this.ensureUser(user);
		userState[symbol] = userState[symbol] || { supplied: 0n, borrowed: 0n };
		userState[symbol].supplied += amt;
		market.totalSupply += amt;
		return { ok: true, user: userState[symbol], market };
	}

	borrow(user, symbol, amount) {
		const amt = BigInt(amount);
		if (amt <= 0) throw new Error('amount must be positive');
		const market = this.ensureMarket(symbol);
		const userState = this.ensureUser(user);
		userState[symbol] = userState[symbol] || { supplied: 0n, borrowed: 0n };
		// naive LTV: must supply at least as much as borrow (1:1)
		if (userState[symbol].supplied < amt) throw new Error('insufficient collateral');
		userState[symbol].borrowed += amt;
		market.totalBorrow += amt;
		return { ok: true, user: userState[symbol], market };
	}

	repay(user, symbol, amount) {
		const amt = BigInt(amount);
		if (amt <= 0) throw new Error('amount must be positive');
		const market = this.ensureMarket(symbol);
		const userState = this.ensureUser(user);
		userState[symbol] = userState[symbol] || { supplied: 0n, borrowed: 0n };
		const repayAmt = amt > userState[symbol].borrowed ? userState[symbol].borrowed : amt;
		userState[symbol].borrowed -= repayAmt;
		market.totalBorrow -= repayAmt;
		return { ok: true, repaid: repayAmt.toString(), user: userState[symbol], market };
	}

	redeem(user, symbol, amount) {
		const amt = BigInt(amount);
		if (amt <= 0) throw new Error('amount must be positive');
		const market = this.ensureMarket(symbol);
		const userState = this.ensureUser(user);
		userState[symbol] = userState[symbol] || { supplied: 0n, borrowed: 0n };
		// cannot redeem if it would break collateral >= borrowed
		const available = userState[symbol].supplied - userState[symbol].borrowed;
		if (amt > available) throw new Error('insufficient available supplied balance');
		userState[symbol].supplied -= amt;
		market.totalSupply -= amt;
		return { ok: true, user: userState[symbol], market };
	}
}
